import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from '../env';
import { approvedStats, displayName, getSpaceBySlug, getTestimonial, listApproved } from '../lib/db';
import { originOf, poweredByUrl } from '../lib/http';
import { mediaUrl } from '../lib/uploads';
import type { PublicPayload } from '../shared/types';

const api = new Hono<AppEnv>();

api.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 86400 }));

/** Approved testimonials for a space. Powers the embed widget; also usable directly. */
api.get('/spaces/:slug', async (c) => {
  const space = await getSpaceBySlug(c.env.DB, c.req.param('slug'));
  if (!space) return c.json({ error: 'Space not found' }, 404);

  const origin = originOf(c);
  const id = c.req.query('id');
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') ?? '', 10) || 50));

  const [items, stats] = await Promise.all([
    id
      ? getTestimonial(c.env.DB, id).then((t) => (t && t.spaceId === space.id && t.status === 'approved' ? [t] : []))
      : listApproved(c.env.DB, space.id, limit),
    approvedStats(c.env.DB, space.id),
  ]);

  const payload: PublicPayload = {
    space: {
      slug: space.slug,
      name: space.name,
      accentColor: space.accentColor,
      logoUrl: mediaUrl(origin, space.logoKey),
      collectUrl: `${origin}/c/${space.slug}`,
      wallUrl: `${origin}/w/${space.slug}`,
      showBranding: space.showBranding,
      poweredByUrl: poweredByUrl(c),
    },
    testimonials: items.map((t) => ({
      id: t.id,
      rating: t.rating,
      body: t.body,
      name: displayName(t),
      role: t.authorRole,
      photoUrl: mediaUrl(origin, t.photoKey),
      featured: t.featured,
      source: t.source,
      sourceUrl: t.sourceUrl,
      createdAt: t.createdAt,
    })),
    stats,
  };

  c.header('Cache-Control', 'public, max-age=60');
  return c.json(payload);
});

api.all('*', (c) => c.json({ error: 'Not found' }, 404));

export default api;
