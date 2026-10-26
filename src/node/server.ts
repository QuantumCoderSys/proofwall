// Runs ProofWall on any Node 22+ / Docker host (Fly.io, Railway, Render, a VPS, Coolify…).
// The Worker code runs unchanged: D1 becomes a SQLite file, R2 becomes a folder, the
// cron trigger becomes an hourly timer, and static files are served from ./public.
//
//   npm run build:node && node dist/server.mjs
//
// Env: ADMIN_PASSWORD, SESSION_SECRET (required) · PORT (8080) · DATA_DIR (./data)
//      PUBLIC_URL (e.g. https://reviews.example.com) · POWERED_BY_URL · TRUST_PROXY (true)
import { serve, type HttpBindings } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Env } from '../env';
import worker from '../index';
import { runDueImports } from '../lib/auto-import';
import { openDatabase } from './d1';
import { applyMigrations } from './migrate';
import { FileBucket } from './r2';

const PORT = Number(process.env.PORT ?? 8080);
const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
const PUBLIC_DIR = process.env.PUBLIC_DIR ?? 'public';
const PUBLIC_URL = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL) : null;
const TRUST_PROXY = process.env.TRUST_PROXY !== 'false';

mkdirSync(DATA_DIR, { recursive: true });
const db = openDatabase(join(DATA_DIR, 'proofwall.db'));
const applied = applyMigrations(db.sqlite, resolve(process.env.MIGRATIONS_DIR ?? 'migrations'));
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

const env: Env = {
  DB: db as unknown as D1Database,
  MEDIA: new FileBucket(join(DATA_DIR, 'media')) as unknown as R2Bucket,
  ASSETS: undefined as unknown as Fetcher,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
  POWERED_BY_URL: process.env.POWERED_BY_URL ?? '',
};
if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
  console.warn('ADMIN_PASSWORD and SESSION_SECRET are not both set; the dashboard will show setup instructions.');
}

const ctx = {
  waitUntil(promise: Promise<unknown>) {
    promise.catch((err) => console.error(err));
  },
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext;

/**
 * Rebuilds the request as the browser saw it: public origin (for links, cookies and the
 * CSRF check behind a TLS-terminating proxy) and the real client IP (for rate limits).
 */
function toWorkerRequest(req: Request, socketIp: string | undefined): Request {
  const incoming = new URL(req.url);
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  let origin = incoming.origin;
  if (PUBLIC_URL) {
    origin = PUBLIC_URL.origin;
  } else if (TRUST_PROXY && (forwardedProto || forwardedHost)) {
    const proto = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : incoming.protocol.slice(0, -1);
    origin = `${proto}://${forwardedHost || req.headers.get('host') || incoming.host}`;
  }
  const url = new URL(incoming.pathname + incoming.search, origin);

  const headers = new Headers(req.headers);
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  headers.set('cf-connecting-ip', (TRUST_PROXY && forwardedFor) || socketIp || 'unknown');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: 'manual',
    signal: req.signal,
    // Required by Node's fetch when streaming a request body.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
}

const server = new Hono<{ Bindings: HttpBindings }>();

// Same headers public/_headers gives the widget on Cloudflare.
server.use('/embed.js', async (c, next) => {
  await next();
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
});
server.use('/_headers', async (c) => c.notFound());
server.use('*', serveStatic({ root: PUBLIC_DIR }));
server.all('*', async (c) => worker.fetch(toWorkerRequest(c.req.raw, c.env.incoming.socket.remoteAddress), env, ctx));

const http = serve({ fetch: server.fetch, port: PORT, hostname: process.env.HOST ?? '0.0.0.0' }, (info) => {
  console.log(`ProofWall listening on http://localhost:${info.port} (data in ${DATA_DIR})`);
});

// The Worker's daily cron, as a timer. Each saved link is re-checked at most every ~20h.
const checkImports = () => runDueImports(env).catch((err) => console.error('Import check failed', err));
const firstCheck = setTimeout(checkImports, 60_000);
const hourly = setInterval(checkImports, 60 * 60 * 1000);

const shutdown = () => {
  clearTimeout(firstCheck);
  clearInterval(hourly);
  http.close(() => {
    db.sqlite.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
