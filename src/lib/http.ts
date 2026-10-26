import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

export const originOf = (c: Context) => new URL(c.req.url).origin;

export const poweredByUrl = (c: Context<AppEnv>) => c.env.POWERED_BY_URL || `${originOf(c)}/`;

/** Reads a trimmed string field from a parsed form body. */
export function field(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  return typeof value === 'string' ? value.trim() : '';
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** Baseline security headers. Collection forms and walls may be iframed; the dashboard may not. */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) return;
  const embeddable = /^\/(c|w)\//.test(c.req.path);
  c.header('Content-Security-Policy', `${CSP}; frame-ancestors ${embeddable ? '*' : "'none'"}`);
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!embeddable) c.header('X-Frame-Options', 'DENY');
};
