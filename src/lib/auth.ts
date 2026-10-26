import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { AppEnv, Env } from '../env';

const COOKIE = 'pw_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function authConfigured(env: Env): boolean {
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET);
}

// Mixing the password into the key means changing it signs every session out.
function signingKey(env: Env): string {
  return `${env.SESSION_SECRET ?? ''}\u0000${env.ADMIN_PASSWORD ?? ''}`;
}

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

export async function passwordMatches(env: Env, input: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const [a, b] = await Promise.all([digest(input), digest(env.ADMIN_PASSWORD)]);
  // Constant-time compare of equal-length digests (portable: Workers and Node).
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export async function startSession(c: Context<AppEnv>): Promise<void> {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  await setSignedCookie(c, COOKIE, String(expires), signingKey(c.env), {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE, { path: '/' });
}

export async function hasSession(c: Context<AppEnv>): Promise<boolean> {
  if (!authConfigured(c.env)) return false;
  const value = await getSignedCookie(c, signingKey(c.env), COOKIE);
  return typeof value === 'string' && Number(value) > Date.now();
}

export function wantsJson(c: Context): boolean {
  return (c.req.header('accept') ?? '').includes('application/json');
}

/** Only allow same-site relative redirects. */
export function safeNext(input: unknown, fallback = '/app'): string {
  if (typeof input !== 'string') return fallback;
  if (!input.startsWith('/') || input.startsWith('//') || input.startsWith('/\\')) return fallback;
  return input;
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (await hasSession(c)) return next();
  if (wantsJson(c)) return c.json({ ok: false, error: 'Your session expired. Please sign in again.' }, 401);
  const url = new URL(c.req.url);
  return c.redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
};
