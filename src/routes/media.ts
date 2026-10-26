import { Hono } from 'hono';
import type { AppEnv } from '../env';

const media = new Hono<AppEnv>();

const KEY = /^(photos|logos)\/[A-Za-z0-9]{8,40}\.(jpg|png|gif|webp|avif|svg)$/;

/** Serves uploaded images from R2. Keys are random and never reused, so responses are immutable. */
media.get('/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  if (!KEY.test(key)) return c.notFound();

  const object = await c.env.MEDIA.get(key, { onlyIf: c.req.raw.headers });
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  // SVG logos must never run script, even when opened directly.
  headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});

export default media;
