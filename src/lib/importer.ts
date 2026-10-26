// Pulls testimonials out of public web pages for free: the Worker fetches the page
// itself, so no scraping service or paid API is involved.
//
// Supported sources:
//   • schema.org Review data in JSON-LD (published by many review sites and shops)
//   • posts on X and Bluesky, via their public oEmbed endpoints
//   • <blockquote> testimonials on any page (with <cite>/<figcaption> for credit),
//     including embedded tweets and Bluesky posts
import { Parser } from 'htmlparser2';
import { sha256Hex } from './ids';
import type { ImportKind } from '../shared/source';

export interface Candidate {
  body: string;
  name: string | null;
  role: string | null;
  rating: number | null;
  source: ImportKind;
  sourceUrl: string;
  externalId: string;
  createdAt: number;
}

export interface ExtractResult {
  candidates: Candidate[];
  summary: string;
}

export class ImportError extends Error {}

const USER_AGENT = 'ProofWall/1.0 (+https://github.com/QuantumCoderSys/proofwall)';
const MAX_CANDIDATES = 50;
const MIN_BODY = 15;
const MAX_BODY = 2000;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;

const X_POST = /^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/[^/]+\/status(?:es)?\/(\d+)/i;
const BLUESKY_POST = /^https?:\/\/bsky\.app\/profile\/[^/]+\/post\/([a-z0-9]+)/i;

/** A single post (rather than a page) — there's nothing new to find by re-checking it. */
export const isSinglePost = (url: string) => X_POST.test(url) || BLUESKY_POST.test(url);

/** Validates a user-supplied link. Returns a normalised URL string. */
export function parseImportUrl(input: string, ownHost?: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ImportError('That doesn’t look like a link. Paste a full URL starting with https://');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ImportError('Only http and https links can be imported.');
  if (ownHost && url.host === ownHost) throw new ImportError('That link points at ProofWall itself — paste a page from another site.');
  url.hash = '';
  return url.toString();
}

export async function extractFromUrl(input: string, ownHost?: string): Promise<ExtractResult> {
  const url = parseImportUrl(input, ownHost);
  const x = url.match(X_POST);
  if (x) return fromOEmbed('https://publish.twitter.com/oembed', url, 'x', `x:${x[1]}`);
  const bsky = url.match(BLUESKY_POST);
  if (bsky) return fromOEmbed('https://embed.bsky.app/oembed', url, 'bluesky', `bluesky:${bsky[1]}`);
  return fromPage(url);
}

// ── oEmbed (X, Bluesky) ───────────────────────────────────────────────────

async function fromOEmbed(endpoint: string, url: string, kind: ImportKind, externalId: string): Promise<ExtractResult> {
  const label = kind === 'x' ? 'X' : 'Bluesky';
  const query = new URLSearchParams({ url, omit_script: '1', dnt: 'true' });
  let res: Response;
  try {
    res = await fetch(`${endpoint}?${query}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ImportError(`Couldn’t reach ${label}. Please try again in a moment.`);
  }
  if (!res.ok) throw new ImportError(`${label} couldn’t find that post. Is it public?`);
  const data = (await res.json()) as { author_name?: string; author_url?: string; html?: string };
  const { quotes } = scanHtml(data.html ?? '');
  const quote = quotes[0];
  if (!quote) throw new ImportError(`${label} returned that post without any text.`);
  const credit = parseCredit(quote.cite);
  const handle = data.author_url?.split('/').filter(Boolean).pop();
  const candidate = clean({
    body: quote.body,
    // Bluesky's author_name is "Display Name (@handle)"; the handle already goes in `role`.
    name: data.author_name?.replace(/\s*\(@[^)]+\)\s*$/, '') || credit.name,
    role: handle ? `@${handle.replace(/^@/, '')}` : credit.role,
    rating: null,
    source: kind,
    sourceUrl: url,
    externalId,
    createdAt: credit.date ?? Date.now(),
  });
  if (!candidate) throw new ImportError(`That post on ${label} is too short to use as a testimonial.`);
  return { candidates: [candidate], summary: `Found the post on ${label}.` };
}

// ── Web pages ─────────────────────────────────────────────────────────────

async function fromPage(url: string): Promise<ExtractResult> {
  const host = new URL(url).host.replace(/^www\./, '');
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ImportError(`Couldn’t reach ${host}. Check the link and try again.`);
  }
  if ([401, 403, 429, 503].includes(res.status)) {
    throw new ImportError(
      `${host} blocked automated access (HTTP ${res.status}). Some sites do — add those testimonials by hand below.`,
    );
  }
  if (!res.ok) throw new ImportError(`${host} returned HTTP ${res.status} for that page.`);
  if (!(res.headers.get('content-type') ?? '').includes('html')) throw new ImportError('That link isn’t a web page.');
  if (Number(res.headers.get('content-length') ?? 0) > MAX_PAGE_BYTES) throw new ImportError('That page is too large to scan.');

  const finalUrl = res.url || url;
  const { jsonLd, quotes } = scanHtml(await readCapped(res));

  const reviews = await reviewsFromJsonLd(jsonLd, finalUrl);
  const seen = new Set(reviews.map((r) => fingerprint(r.body)));
  const fromQuotes: Candidate[] = [];
  for (const quote of quotes) {
    if (seen.has(fingerprint(quote.body))) continue;
    const candidate = await quoteToCandidate(quote, finalUrl);
    if (!candidate) continue;
    seen.add(fingerprint(candidate.body));
    fromQuotes.push(candidate);
  }

  const candidates = [...reviews, ...fromQuotes].slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) {
    throw new ImportError(
      `No testimonials found on ${host}. ProofWall looks for review data (schema.org) and <blockquote> quotes — if the page loads them with JavaScript, add them by hand below.`,
    );
  }
  const parts = [];
  if (reviews.length) parts.push(`${reviews.length} review${reviews.length === 1 ? '' : 's'} in the page’s review data`);
  if (fromQuotes.length) parts.push(`${fromQuotes.length} quote${fromQuotes.length === 1 ? '' : 's'}`);
  return { candidates, summary: `Found ${parts.join(' and ')} on ${host}.` };
}

async function quoteToCandidate(quote: RawQuote, pageUrl: string): Promise<Candidate | null> {
  const credit = parseCredit(quote.cite);
  if (quote.embed && quote.link) {
    const x = quote.link.match(X_POST);
    const bsky = quote.link.match(BLUESKY_POST);
    const kind: ImportKind | null = x ? 'x' : bsky ? 'bluesky' : null;
    if (kind) {
      return clean({
        body: quote.body,
        name: credit.name,
        role: credit.role,
        rating: null,
        source: kind,
        sourceUrl: quote.link,
        externalId: `${kind}:${(x ?? bsky)![1]}`,
        createdAt: credit.date ?? Date.now(),
      });
    }
  }
  return clean({
    body: quote.body,
    name: credit.name,
    role: credit.role,
    rating: null,
    source: 'web',
    sourceUrl: pageUrl,
    externalId: `web:${(await sha256Hex(`${fingerprint(quote.body)}|${credit.name ?? ''}`)).slice(0, 32)}`,
    createdAt: Date.now(),
  });
}

// ── HTML scanning ─────────────────────────────────────────────────────────

interface RawQuote {
  body: string;
  cite: string;
  embed: boolean;
  link: string | null;
}

/** Reads a response body as text, refusing anything over MAX_PAGE_BYTES. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PAGE_BYTES) {
      await reader.cancel();
      throw new ImportError('That page is too large to scan.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/**
 * One pass over the page collecting JSON-LD blocks and blockquotes. Uses htmlparser2
 * (pure JS) so the same code runs on Cloudflare Workers and Node.
 */
function scanHtml(html: string): { jsonLd: string[]; quotes: RawQuote[] } {
  const jsonLd: string[] = [];
  const quotes: RawQuote[] = [];
  const figures: RawQuote[] = [];
  // What each open element started, so its closing tag can undo exactly that.
  const open: Array<{ name: string; figure?: RawQuote; quote?: { group: RawQuote; standalone: boolean }; credit?: boolean; paragraph?: boolean; ld?: boolean }> = [];
  let quote: RawQuote | null = null;
  let ld: string | null = null;
  let creditDepth = 0;
  let paragraphDepth = 0;

  const commit = (q: RawQuote) => {
    if (normalize(q.body).length >= MIN_BODY) quotes.push(q);
  };

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const entry: (typeof open)[number] = { name };
        if (name === 'script' && attrs.type === 'application/ld+json') {
          ld = '';
          entry.ld = true;
        } else if (name === 'figure') {
          entry.figure = { body: '', cite: '', embed: false, link: null };
          figures.push(entry.figure);
        } else if (name === 'blockquote' && !quote) {
          const parent = figures[figures.length - 1];
          const inFigure = Boolean(parent && !parent.body);
          const group = inFigure ? parent! : { body: '', cite: '', embed: false, link: null };
          group.embed = /twitter-tweet|bluesky-embed/.test(attrs.class ?? '');
          quote = group;
          entry.quote = { group, standalone: !inFigure };
        } else if (quote && name === 'p') {
          paragraphDepth++;
          entry.paragraph = true;
        } else if (quote && name === 'br') {
          if (creditDepth === 0 && (!quote.embed || paragraphDepth > 0)) quote.body += '\n';
        } else if (quote?.embed && name === 'a' && attrs.href && (X_POST.test(attrs.href) || BLUESKY_POST.test(attrs.href))) {
          quote.link = attrs.href.split('?')[0]!;
        }
        if (name === 'cite' || name === 'figcaption' || (name === 'footer' && quote)) {
          creditDepth++;
          entry.credit = true;
        }
        if (!VOID_TAGS.has(name)) open.push(entry);
      },
      ontext(text) {
        if (ld !== null) {
          ld += text;
          return;
        }
        if (creditDepth > 0) {
          const target = quote ?? figures[figures.length - 1];
          if (target) target.cite += text;
          return;
        }
        if (!quote) return;
        // Embedded posts keep the post text in <p>; everything after it is the credit line.
        if (quote.embed && paragraphDepth === 0) quote.cite += text;
        else quote.body += text;
      },
      onclosetag(name) {
        if (VOID_TAGS.has(name)) return;
        const index = open.map((e) => e.name).lastIndexOf(name);
        if (index === -1) return;
        for (const entry of open.splice(index).reverse()) {
          if (entry.ld) {
            if (ld) jsonLd.push(ld);
            ld = null;
          }
          if (entry.credit) creditDepth--;
          if (entry.paragraph) {
            paragraphDepth--;
            if (quote && creditDepth === 0) quote.body += '\n\n';
          }
          if (entry.quote) {
            quote = null;
            if (entry.quote.standalone) commit(entry.quote.group);
          }
          if (entry.figure) {
            figures.pop();
            if (entry.figure.body) commit(entry.figure);
          }
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  return {
    jsonLd,
    quotes: quotes.map((q) => ({ ...q, body: normalize(q.body), cite: normalize(q.cite) })),
  };
}

// ── JSON-LD reviews ───────────────────────────────────────────────────────

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

async function reviewsFromJsonLd(blocks: string[], pageUrl: string): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const visit = async (node: Json): Promise<void> => {
    if (Array.isArray(node)) {
      for (const child of node) await visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const types = ([] as Json[]).concat(node['@type'] ?? []).map(String);
    if (types.some((t) => /review$/i.test(t))) {
      const candidate = await reviewToCandidate(node, pageUrl);
      if (candidate) found.push(candidate);
    }
    for (const value of Object.values(node)) if (value && typeof value === 'object') await visit(value);
  };
  for (const block of blocks) {
    try {
      await visit(JSON.parse(block.trim()) as Json);
    } catch {
      // Malformed JSON-LD is common; skip the block.
    }
  }
  return found;
}

async function reviewToCandidate(review: { [key: string]: Json }, pageUrl: string): Promise<Candidate | null> {
  const text = firstString(review.reviewBody) ?? firstString(review.description) ?? firstString(review.text);
  if (!text) return null;
  const author = Array.isArray(review.author) ? review.author[0] : review.author;
  const name =
    typeof author === 'string' ? author : author && typeof author === 'object' && !Array.isArray(author) ? firstString(author.name) : null;
  const role =
    author && typeof author === 'object' && !Array.isArray(author) ? firstString(author.jobTitle) : null;

  let rating: number | null = null;
  const r = review.reviewRating;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    const value = Number(r.ratingValue);
    const best = Number(r.bestRating) || 5;
    if (Number.isFinite(value) && value > 0) rating = Math.min(5, Math.max(1, Math.round((value / best) * 5)));
  }

  const date = Date.parse(firstString(review.datePublished) ?? '');
  const link = firstString(review.url);
  const body = stripTags(text);
  return clean({
    body,
    name: name ? stripTags(name) : null,
    role: role ? stripTags(role) : null,
    rating,
    source: 'web',
    sourceUrl: link && /^https?:\/\//.test(link) ? link : pageUrl,
    externalId: `web:${(await sha256Hex(`${fingerprint(body)}|${name ?? ''}`)).slice(0, 32)}`,
    createdAt: Number.isFinite(date) && date <= Date.now() ? date : Date.now(),
  });
}

// ── Text helpers ──────────────────────────────────────────────────────────

const firstString = (v: Json | undefined): string | null =>
  typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null;

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•', copy: '©', eacute: 'é',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return normalize(decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')));
}

function normalize(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^["“”\s]+|["“”\s]+$/g, '')
    .trim();
}

const fingerprint = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 160);

/** "— Jane Doe, CEO at Acme" / "Jane Doe (@jane) October 1, 2025" → parts. */
function parseCredit(raw: string): { name: string | null; role: string | null; date: number | null } {
  let text = raw.replace(/^[\s—–\-~]+/, '').trim();
  let date: number | null = null;
  const dateMatch = text.match(/([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})/);
  if (dateMatch) {
    const parsed = Date.parse(dateMatch[1]!.replace('.', ''));
    if (Number.isFinite(parsed)) date = parsed;
    text = text.replace(dateMatch[0], '').replace(/\bat \d{1,2}:\d{2}\s*[AP]M\b/i, '').trim();
  }
  const handle = text.match(/^(.*?)\s*\((@[^)]+)\)/);
  if (handle) return { name: handle[1]!.trim() || null, role: handle[2]!, date };
  const [name, ...rest] = text.split(/\s*[,|·]\s*|\s+[—–-]\s+/);
  return { name: name?.trim().slice(0, 80) || null, role: rest.join(', ').trim().slice(0, 100) || null, date };
}

function clean(c: Candidate): Candidate | null {
  let text = c.body;
  // Posts end with media/short links that mean nothing outside the original platform.
  if (c.source !== 'web') text = normalize(text.replace(/\s*(?:pic\.twitter\.com|https?:\/\/t\.co)\/\S+/g, ''));
  const body = text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1).trimEnd()}…` : text;
  if (body.length < MIN_BODY) return null;
  return {
    ...c,
    body,
    name: c.name?.trim().slice(0, 80) || null,
    role: c.role?.trim().slice(0, 100) || null,
  };
}

/** Re-validates a candidate that round-tripped through the browser before it is stored. */
export function sanitizeCandidate(input: unknown): Candidate | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const source = str(c.source);
  if (source !== 'web' && source !== 'x' && source !== 'bluesky') return null;
  const sourceUrl = str(c.sourceUrl);
  if (!sourceUrl || !/^https?:\/\//.test(sourceUrl) || sourceUrl.length > 500) return null;
  const rating = typeof c.rating === 'number' && Number.isInteger(c.rating) && c.rating >= 1 && c.rating <= 5 ? c.rating : null;
  const createdAt = typeof c.createdAt === 'number' && c.createdAt > 0 && c.createdAt <= Date.now() ? c.createdAt : Date.now();
  const externalId = str(c.externalId);
  return clean({
    body: normalize(str(c.body) ?? ''),
    name: str(c.name),
    role: str(c.role),
    rating,
    source,
    sourceUrl,
    externalId: externalId && externalId.length <= 120 ? externalId : `web:${crypto.randomUUID()}`,
    createdAt,
  });
}
