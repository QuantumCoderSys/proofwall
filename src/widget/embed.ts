/*
 * ProofWall embed widget.
 *
 *   <script src="https://your-proofwall.dev/embed.js" data-space="acme" data-layout="carousel" async></script>
 *
 * or, to control placement precisely:
 *
 *   <div data-proofwall="acme" data-layout="wall"></div>
 *   <script src="https://your-proofwall.dev/embed.js" async></script>
 *
 * Renders inside a Shadow DOM so host-page styles can't leak in (or out).
 * All testimonial text is inserted as text nodes, never as HTML.
 */
import { avatarColors, initials } from '../shared/avatar';
import type { Layout, MountOptions, PublicPayload, PublicTestimonial, Theme } from '../shared/types';

const VERSION = '1.0.0';
const SVG_NS = 'http://www.w3.org/2000/svg';
const STAR = 'M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap';
const LOGO =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6.5" fill="currentColor"/><g fill="var(--pw-logo-ink)" transform="translate(0 -0.6)"><path d="M5.75 14.5C5.75 11.4 7.4 9 10 8l.45.95c-1.25.65-2.05 1.65-2.25 2.82A2.75 2.75 0 1 1 5.75 14.5Z"/><path d="M12.75 14.5c0-3.1 1.65-5.5 4.25-6.5l.45.95c-1.25.65-2.05 1.65-2.25 2.82a2.75 2.75 0 1 1-2.45 2.73Z"/></g></svg>';
const CHEVRON_LEFT =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const CHEVRON_RIGHT =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

const LAYOUTS: readonly Layout[] = ['wall', 'carousel', 'card'];
const THEMES: readonly Theme[] = ['light', 'dark', 'auto'];
const DEFAULT_LIMIT: Record<Layout, number> = { wall: 50, carousel: 20, card: 10 };
const WALL_PAGE = 9;

type Options = Required<Omit<MountOptions, 'id'>> & { id?: string };

const currentScript = document.currentScript as HTMLScriptElement | null;
const ORIGIN = currentScript?.src ? new URL(currentScript.src).origin : location.origin;

const requests = new Map<string, Promise<PublicPayload>>();
const cleanups = new WeakMap<HTMLElement, () => void>();
let mountSeq = 0;

// ── Helpers ───────────────────────────────────────────────────────────────

type ChildLike = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string> | null,
  ...children: ChildLike[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  for (const child of children) if (child) el.append(child);
  return el;
}

function svgFrom(markup: string): Element {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup;
  return tpl.content.firstElementChild!;
}

function luminance(hex: string): number {
  const c = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return /^#[0-9a-f]{6}$/i.test(hex) ? 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5) : 0;
}

function normalize(input: MountOptions): Options {
  const layout = LAYOUTS.includes(input.layout as Layout) ? (input.layout as Layout) : 'wall';
  const theme = THEMES.includes(input.theme as Theme) ? (input.theme as Theme) : 'light';
  const limit = Number.isFinite(input.limit) ? Math.min(100, Math.max(1, Math.round(input.limit!))) : DEFAULT_LIMIT[layout];
  return {
    space: String(input.space ?? '').trim(),
    layout,
    theme,
    limit,
    id: input.id || undefined,
    autoplay: input.autoplay !== false,
    font: input.font === 'inherit' ? 'inherit' : 'default',
    preview: input.preview === true,
  };
}

function load(opts: Options): Promise<PublicPayload> {
  const url = new URL(`/api/v1/spaces/${encodeURIComponent(opts.space)}`, ORIGIN);
  url.searchParams.set('limit', String(opts.limit));
  if (opts.id) url.searchParams.set('id', opts.id);
  const key = url.toString();
  if (opts.preview) requests.delete(key);
  let pending = requests.get(key);
  if (!pending) {
    pending = fetch(key, { mode: 'cors', credentials: 'omit', cache: opts.preview ? 'no-store' : 'default' }).then(
      (res) => {
        if (!res.ok) throw new Error(`ProofWall: couldn't load "${opts.space}" (HTTP ${res.status})`);
        return res.json() as Promise<PublicPayload>;
      },
    );
    pending.catch(() => requests.delete(key));
    requests.set(key, pending);
  }
  return pending;
}

function ensureFonts(): void {
  if (document.querySelector('link[data-proofwall-fonts]')) return;
  const link = h('link', { rel: 'stylesheet', href: FONT_HREF, 'data-proofwall-fonts': '' });
  (document.head ?? document.documentElement).append(link);
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ── Pieces ────────────────────────────────────────────────────────────────

function stars(rating: number): HTMLElement {
  const wrap = h('div', { class: 'pw-stars', role: 'img', 'aria-label': `${rating} out of 5 stars` });
  for (let i = 1; i <= 5; i++) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (i <= rating) svg.setAttribute('class', 'on');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', STAR);
    svg.append(path);
    wrap.append(svg);
  }
  return wrap;
}

function avatar(t: PublicTestimonial): HTMLElement {
  if (t.photoUrl) {
    return h('img', { class: 'pw-avatar', src: t.photoUrl, alt: '', loading: 'lazy', decoding: 'async', width: '38', height: '38' });
  }
  const { bg, fg } = avatarColors(t.name);
  return h('span', { class: 'pw-avatar', style: `background:${bg};color:${fg}`, 'aria-hidden': 'true' }, initials(t.name));
}

function card(t: PublicTestimonial, variant: 'wall' | 'carousel' | 'single'): HTMLElement {
  const body = h('blockquote', { class: variant === 'carousel' ? 'pw-body pw-clamp' : 'pw-body' }, t.body);
  const classes = ['pw-card'];
  if (t.featured) classes.push('is-featured');
  if (variant === 'single') classes.push('is-single');
  return h(
    'figure',
    { class: classes.join(' ') },
    stars(t.rating),
    body,
    h(
      'figcaption',
      { class: 'pw-author' },
      avatar(t),
      h('div', { class: 'pw-who' }, h('div', { class: 'pw-name' }, t.name), t.role && h('div', { class: 'pw-role' }, t.role)),
    ),
  );
}

/** Adds "Read more" to clamped quotes once they're laid out. */
function addReadMore(scope: ParentNode): void {
  requestAnimationFrame(() => {
    for (const body of scope.querySelectorAll<HTMLElement>('.pw-clamp')) {
      if (body.scrollHeight <= body.clientHeight + 2 || body.nextElementSibling?.classList.contains('pw-readmore')) continue;
      const btn = h('button', { type: 'button', class: 'pw-readmore', 'aria-expanded': 'false' }, 'Read more');
      btn.addEventListener('click', () => {
        const open = body.classList.toggle('is-open');
        btn.textContent = open ? 'Show less' : 'Read more';
        btn.setAttribute('aria-expanded', String(open));
      });
      body.after(btn);
    }
  });
}

function poweredBy(url: string): HTMLElement {
  const link = h('a', { class: 'pw-powered', href: url, target: '_blank', rel: 'noopener' });
  link.append(svgFrom(LOGO), 'Powered by ', h('strong', null, 'ProofWall'));
  return link;
}

function navButton(dir: 'prev' | 'next'): HTMLButtonElement {
  const btn = h('button', { type: 'button', class: 'pw-navbtn', 'aria-label': dir === 'prev' ? 'Previous' : 'Next' });
  btn.append(svgFrom(dir === 'prev' ? CHEVRON_LEFT : CHEVRON_RIGHT));
  return btn;
}

/** Runs `tick` every `ms` while the widget is visible and not hovered/focused. */
function autoplay(root: HTMLElement, tick: () => void, ms: number): () => void {
  let paused = false;
  let visible = true;
  const pause = () => (paused = true);
  const resume = () => (paused = false);
  root.addEventListener('pointerenter', pause);
  root.addEventListener('pointerleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', resume);
  root.addEventListener('touchstart', pause, { passive: true });
  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? true))
      : null;
  observer?.observe(root);
  const timer = window.setInterval(() => {
    if (!paused && visible && !document.hidden) tick();
  }, ms);
  return () => {
    window.clearInterval(timer);
    observer?.disconnect();
  };
}

// ── Layouts ───────────────────────────────────────────────────────────────

function renderWall(root: HTMLElement, items: PublicTestimonial[], foot: HTMLElement): void {
  const grid = h('div', { class: 'pw-wall' });
  const more = h('button', { type: 'button', class: 'pw-btn' }, 'Show more');
  let shown = 0;
  const showNext = () => {
    for (const t of items.slice(shown, shown + WALL_PAGE)) grid.append(card(t, 'wall'));
    shown = Math.min(items.length, shown + WALL_PAGE);
    more.hidden = shown >= items.length;
  };
  more.addEventListener('click', showNext);
  showNext();
  root.append(grid);
  if (!more.hidden) root.append(h('div', { class: 'pw-more' }, more));
  root.append(foot);
}

function renderCarousel(root: HTMLElement, items: PublicTestimonial[], foot: HTMLElement, opts: Options, label: string) {
  const track = h('div', {
    class: 'pw-track',
    role: 'region',
    'aria-roledescription': 'carousel',
    'aria-label': label,
    tabindex: '0',
  });
  for (const t of items) track.append(h('div', { class: 'pw-slide' }, card(t, 'carousel')));

  const prev = navButton('prev');
  const next = navButton('next');
  const step = () => (track.querySelector('.pw-slide')?.getBoundingClientRect().width ?? 320) + 16;
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const smooth: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const update = () => {
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = atEnd() && track.scrollLeft <= 4;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: smooth }));
  next.addEventListener('click', () =>
    atEnd() ? track.scrollTo({ left: 0, behavior: smooth }) : track.scrollBy({ left: step(), behavior: smooth }),
  );
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') next.click();
    if (e.key === 'ArrowLeft') prev.click();
  });

  foot.append(h('div', { class: 'pw-nav' }, prev, next));
  root.append(track, foot);
  addReadMore(track);
  requestAnimationFrame(update);

  if (opts.autoplay && items.length > 1 && !prefersReducedMotion()) {
    return autoplay(root, () => next.click(), 5000);
  }
  return undefined;
}

function renderSingle(root: HTMLElement, items: PublicTestimonial[], foot: HTMLElement, opts: Options) {
  const stage = h('div', { class: 'pw-single', 'aria-live': 'polite' });
  let index = 0;
  const dots: HTMLButtonElement[] = [];
  const show = (i: number) => {
    index = (i + items.length) % items.length;
    const el = card(items[index]!, 'single');
    if (stage.firstChild) el.classList.add('pw-fade');
    stage.replaceChildren(el);
    dots.forEach((d, n) => d.setAttribute('aria-current', String(n === index)));
  };

  if (items.length > 1) {
    const nav = h('div', { class: 'pw-dots', role: 'tablist', 'aria-label': 'Choose testimonial' });
    items.forEach((_, n) => {
      const dot = h('button', { type: 'button', class: 'pw-dot', 'aria-label': `Testimonial ${n + 1}` });
      dot.addEventListener('click', () => show(n));
      dots.push(dot);
      nav.append(dot);
    });
    foot.append(nav);
  }
  show(0);
  root.append(stage, foot);

  if (opts.autoplay && items.length > 1 && !prefersReducedMotion()) {
    return autoplay(root, () => show(index + 1), 6500);
  }
  return undefined;
}

function skeleton(layout: Layout): HTMLElement {
  const count = layout === 'card' ? 1 : 3;
  const wrap = h('div', { class: `pw-skel pw-skel-${layout}`, 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    wrap.append(h('div', { class: 'pw-skel-card' }, h('span', null), h('span', null), h('span', { class: 'short' })));
  }
  return wrap;
}

// ── Mount ─────────────────────────────────────────────────────────────────

async function mount(host: HTMLElement, input: MountOptions): Promise<void> {
  const opts = normalize(input);
  if (!opts.space) {
    console.warn('[ProofWall] Missing data-space attribute.');
    return;
  }
  cleanups.get(host)?.();
  cleanups.delete(host);
  const token = String(++mountSeq);
  host.dataset.pwMounted = token;

  if (opts.font === 'default') ensureFonts();
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const root = h('div', { class: 'pw', 'data-theme': opts.theme, 'data-layout': opts.layout });
  shadow.replaceChildren(h('style', null, styles(opts.font)), root);
  root.append(skeleton(opts.layout));

  let data: PublicPayload;
  try {
    data = await load(opts);
  } catch (err) {
    if (host.dataset.pwMounted !== token) return;
    root.replaceChildren();
    if (opts.preview) root.append(h('p', { class: 'pw-empty' }, 'Could not load testimonials.'));
    console.warn(err);
    return;
  }
  if (host.dataset.pwMounted !== token) return;

  const accent = /^#[0-9a-f]{6}$/i.test(data.space.accentColor) ? data.space.accentColor : '#171717';
  root.style.setProperty('--pw-accent', accent);
  root.style.setProperty('--pw-accent-dark', luminance(accent) < 0.08 ? '#fafafa' : accent);
  root.replaceChildren();

  const items = data.testimonials;
  if (items.length === 0) {
    if (opts.preview) {
      root.append(h('p', { class: 'pw-empty' }, 'Approved testimonials will appear here.'));
    }
    return;
  }

  const foot = h('div', { class: 'pw-foot' });
  if (data.space.showBranding) foot.append(poweredBy(data.space.poweredByUrl));

  let cleanup: (() => void) | undefined;
  if (opts.layout === 'carousel') {
    cleanup = renderCarousel(root, items, foot, opts, `What people say about ${data.space.name}`);
  } else if (opts.layout === 'card') {
    cleanup = renderSingle(root, items, foot, opts);
  } else {
    renderWall(root, items, foot);
  }
  if (!foot.hasChildNodes()) foot.remove();
  if (cleanup) cleanups.set(host, cleanup);
}

function optionsFrom(el: HTMLElement): MountOptions {
  const d = el.dataset;
  return {
    space: d.space ?? d.proofwall ?? '',
    layout: d.layout as Layout | undefined,
    theme: d.theme as Theme | undefined,
    limit: d.limit ? Number(d.limit) : undefined,
    id: d.id,
    autoplay: d.autoplay !== 'false',
    font: d.font === 'inherit' ? 'inherit' : 'default',
  };
}

function autoMount(): void {
  if (currentScript?.dataset.space && !currentScript.dataset.pwDone) {
    currentScript.dataset.pwDone = '1';
    // A custom tag, so host-page rules like `div { … }` can't style the wrapper.
    const host = document.createElement('proofwall-embed');
    if (currentScript.closest('head') || !currentScript.parentNode) document.body.append(host);
    else currentScript.before(host);
    void mount(host, optionsFrom(currentScript));
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-proofwall]:not([data-pw-mounted])')) {
    void mount(el, optionsFrom(el));
  }
}

type Api = { mount: (el: HTMLElement, options: MountOptions) => Promise<void>; version: string };
const w = window as unknown as { ProofWall?: Api };
if (!w.ProofWall) {
  w.ProofWall = { mount, version: VERSION };
  window.dispatchEvent(new Event('proofwall:ready'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
else autoMount();

// ── Styles ────────────────────────────────────────────────────────────────

function styles(font: 'default' | 'inherit'): string {
  const sans =
    font === 'inherit' ? 'inherit' : "'Geist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const serif = font === 'inherit' ? 'inherit' : "'Newsreader', 'Iowan Old Style', Georgia, serif";
  return `
:host { all: initial; display: block; ${font === 'inherit' ? 'font-family: inherit;' : ''} }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.pw {
  --bg: #ffffff; --fg: #0a0a0a; --fg2: #262626; --muted: #737373; --off: #e5e5e5;
  --ctrl: #ffffff; --pw-logo-ink: #fafafa; --pw-star: var(--pw-accent, #171717);
  --shadow: 0 0 0 1px rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06), 0 2px 4px rgba(0,0,0,.04);
  --shadow-hover: 0 0 0 1px rgba(0,0,0,.09), 0 1px 2px -1px rgba(0,0,0,.08), 0 6px 14px -4px rgba(0,0,0,.08);
  font-family: ${sans}; font-size: 15px; line-height: 1.6; color: var(--fg);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-align: left;
}
.pw[data-theme="dark"] {
  --bg: #171717; --fg: #fafafa; --fg2: #e5e5e5; --muted: #a3a3a3; --off: #3f3f3f; --ctrl: #1f1f1f;
  --pw-logo-ink: #171717; --pw-star: var(--pw-accent-dark, #fafafa);
  --shadow: 0 0 0 1px rgba(255,255,255,.08), 0 2px 8px rgba(0,0,0,.35);
  --shadow-hover: 0 0 0 1px rgba(255,255,255,.14), 0 6px 18px rgba(0,0,0,.45);
}
@media (prefers-color-scheme: dark) {
  .pw[data-theme="auto"] {
    --bg: #171717; --fg: #fafafa; --fg2: #e5e5e5; --muted: #a3a3a3; --off: #3f3f3f; --ctrl: #1f1f1f;
    --pw-logo-ink: #171717; --pw-star: var(--pw-accent-dark, #fafafa);
    --shadow: 0 0 0 1px rgba(255,255,255,.08), 0 2px 8px rgba(0,0,0,.35);
    --shadow-hover: 0 0 0 1px rgba(255,255,255,.14), 0 6px 18px rgba(0,0,0,.45);
  }
}
.pw-card {
  margin: 0; display: flex; flex-direction: column; gap: 14px; padding: 22px;
  background: var(--bg); border-radius: 14px; box-shadow: var(--shadow);
  transition: box-shadow .2s ease, transform .2s ease;
}
.pw-card:hover { box-shadow: var(--shadow-hover); }
.pw-stars { display: flex; gap: 2px; color: var(--off); }
.pw-stars svg { width: 15px; height: 15px; fill: currentColor; }
.pw-stars svg.on { color: var(--pw-star); }
.pw-body {
  margin: 0; color: var(--fg2); font-size: 15px; line-height: 1.65;
  white-space: pre-line; overflow-wrap: anywhere; quotes: none;
}
.is-featured .pw-body { font-family: ${serif}; font-size: 19px; line-height: 1.5; letter-spacing: -.01em; color: var(--fg); }
.pw-clamp { display: -webkit-box; -webkit-line-clamp: 7; -webkit-box-orient: vertical; overflow: hidden; }
.pw-clamp.is-open { display: block; -webkit-line-clamp: unset; }
.pw-readmore {
  align-self: flex-start; margin-top: -6px; padding: 0; border: 0; background: none; cursor: pointer;
  font: 500 13px/1.4 ${sans}; color: var(--muted); text-decoration: underline; text-underline-offset: 3px;
}
.pw-readmore:hover { color: var(--fg); }
.pw-author { display: flex; align-items: center; gap: 11px; margin-top: auto; min-width: 0; }
.pw-avatar {
  width: 38px; height: 38px; flex: none; border-radius: 50%; object-fit: cover;
  display: inline-grid; place-items: center; font-size: 14px; font-weight: 600;
  box-shadow: 0 0 0 1px rgba(0,0,0,.06); background: var(--off);
}
.pw-who { min-width: 0; line-height: 1.35; }
.pw-name { font-size: 14px; font-weight: 600; color: var(--fg); }
.pw-role { font-size: 13px; color: var(--muted); }

.pw-wall { columns: 3 280px; column-gap: 16px; }
.pw-wall > .pw-card { break-inside: avoid; margin-bottom: 16px; }
.pw-more { display: flex; justify-content: center; margin-top: 4px; }
.pw-btn {
  height: 36px; padding: 0 16px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--ctrl); color: var(--fg); box-shadow: var(--shadow); font: 500 13px/1 ${sans};
}
.pw-btn:hover { box-shadow: var(--shadow-hover); }

.pw-track {
  display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory;
  padding: 4px 4px 10px; margin: -4px; scrollbar-width: none; outline: none;
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent);
}
.pw-track::-webkit-scrollbar { display: none; }
.pw-track:focus-visible { box-shadow: inset 0 0 0 2px var(--pw-star); border-radius: 16px; }
.pw-slide { flex: 0 0 min(340px, 86%); scroll-snap-align: start; display: flex; }
.pw-slide > .pw-card { width: 100%; }

.pw-single { max-width: 640px; margin: 0 auto; }
.is-single { padding: 30px 32px; gap: 18px; }
.is-single .pw-body { font-family: ${serif}; font-size: 22px; line-height: 1.45; letter-spacing: -.015em; color: var(--fg); }
.is-single .pw-stars svg { width: 17px; height: 17px; }
.is-single .pw-avatar { width: 42px; height: 42px; }
.pw-fade { animation: pw-fade .45s ease; }
@keyframes pw-fade { from { opacity: 0; transform: translateY(4px); } }

.pw-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; min-height: 34px; }
.pw[data-layout="wall"] .pw-foot { justify-content: center; margin-top: 8px; }
.pw[data-layout="card"] .pw-foot { max-width: 640px; margin-left: auto; margin-right: auto; }
.pw-nav { display: flex; gap: 8px; margin-left: auto; }
.pw-navbtn {
  width: 34px; height: 34px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;
  background: var(--ctrl); color: var(--fg); box-shadow: var(--shadow); cursor: pointer; transition: box-shadow .15s, opacity .15s;
}
.pw-navbtn:hover:not(:disabled) { box-shadow: var(--shadow-hover); }
.pw-navbtn:disabled { opacity: .4; cursor: default; }
.pw-dots { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.pw-dot { width: 6px; height: 6px; padding: 0; border: 0; border-radius: 3px; background: var(--off); cursor: pointer; transition: width .25s ease, background .25s; }
.pw-dot[aria-current="true"] { width: 18px; background: var(--fg); }
.pw-powered {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px 6px 6px; border-radius: 999px;
  font: 400 12px/1 ${sans}; color: var(--muted); text-decoration: none; transition: color .15s, background .15s;
}
.pw-powered svg { color: var(--fg); }
.pw-powered strong { font-weight: 600; }
.pw-powered:hover { color: var(--fg); }
.pw button:focus-visible, .pw a:focus-visible { outline: 2px solid var(--pw-star); outline-offset: 2px; }

.pw-empty {
  margin: 0; padding: 36px 20px; text-align: center; font-size: 14px; color: var(--muted);
  border: 1px dashed var(--off); border-radius: 14px;
}
.pw-skel { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.pw-skel-card {
  min-height: 110px; padding: 22px; display: flex; flex-direction: column; gap: 10px;
  border-radius: 14px; background: var(--bg); box-shadow: var(--shadow);
}
.pw-skel-card:only-child { grid-column: 1 / -1; width: 100%; max-width: 640px; margin: 0 auto; }
.pw-skel-card span { height: 10px; flex: none; border-radius: 6px; background: var(--off); opacity: .6; animation: pw-pulse 1.4s ease-in-out infinite; }
.pw-skel-card span:first-child { width: 40%; }
.pw-skel-card span.short { width: 55%; }
@keyframes pw-pulse { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) {
  .pw-card, .pw-fade, .pw-skel-card span, .pw-dot { animation: none !important; transition: none !important; }
}
`;
}
