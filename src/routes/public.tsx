import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hasSession } from '../lib/auth';
import { approvedStats, getSpaceBySlug, insertTestimonial, listApproved } from '../lib/db';
import { field, poweredByUrl } from '../lib/http';
import { newId } from '../lib/ids';
import { clientIp, rateLimit } from '../lib/rate-limit';
import { isFile, storeImage } from '../lib/uploads';
import { LandingPage } from '../views/pages/auth';
import { CollectPage, ThanksPage, WallPage, type CollectErrors, type CollectValues } from '../views/pages/public';

const pub = new Hono<AppEnv>();

pub.get('/', async (c) => c.html(<LandingPage signedIn={await hasSession(c)} />));

pub.get('/c/:slug', async (c) => {
  const space = await getSpaceBySlug(c.env.DB, c.req.param('slug'));
  if (!space) return c.notFound();
  return c.html(<CollectPage space={space} poweredByUrl={poweredByUrl(c)} />);
});

pub.post('/c/:slug', async (c) => {
  const space = await getSpaceBySlug(c.env.DB, c.req.param('slug'));
  if (!space) return c.notFound();
  const thanks = `/c/${space.slug}/thanks`;
  if (!space.isAccepting) return c.redirect(`/c/${space.slug}`, 303);

  const body = await c.req.parseBody();
  // Honeypot filled in: pretend it worked so bots don't adapt.
  if (field(body, 'website')) return c.redirect(thanks, 303);

  const rating = Number(field(body, 'rating'));
  const values: CollectValues = {
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0,
    body: field(body, 'body')
      .replace(/\r\n?/g, '\n')
      .replace(/[^\S\n]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n'),
    name: field(body, 'name').replace(/\s+/g, ' '),
    role: field(body, 'role').replace(/\s+/g, ' '),
    consent: field(body, 'consent') === '1',
  };

  const errors: CollectErrors = {};
  if (values.rating === 0) errors.rating = 'Please choose a rating.';
  if (values.body.length < 10) errors.body = 'Please write at least a sentence or two.';
  else if (values.body.length > 2000) errors.body = 'Please keep it under 2,000 characters.';
  if (values.name.length > 80) errors.name = 'Please keep your name under 80 characters.';
  if (values.role.length > 100) errors.role = 'Please keep this under 100 characters.';
  if (!values.consent) errors.consent = 'Please confirm we can share your testimonial.';

  const render = (errs: CollectErrors, status: 422 | 429) =>
    c.html(
      <CollectPage
        space={space}
        poweredByUrl={poweredByUrl(c)}
        values={{ ...values, rating: values.rating || 5 }}
        errors={errs}
      />,
      status,
    );

  if (Object.keys(errors).length > 0) return render(errors, 422);

  const allowed = await rateLimit(c.env.DB, `submit:${space.id}`, clientIp(c.req.raw.headers), 5, 10 * 60);
  if (!allowed) {
    return render({ form: "You've sent a few testimonials in a short time. Please try again in a few minutes." }, 429);
  }

  let photoKey: string | null = null;
  if (space.collectPhoto && isFile(body.photo) && body.photo.size > 0) {
    const upload = await storeImage(c.env, body.photo, 'photos');
    if ('error' in upload) return render({ photo: upload.error }, 422);
    photoKey = upload.key;
  }

  await insertTestimonial(c.env.DB, newId(), {
    spaceId: space.id,
    rating: values.rating,
    body: values.body,
    authorName: values.name || null,
    authorRole: values.role || null,
    photoKey,
  });
  return c.redirect(thanks, 303);
});

pub.get('/c/:slug/thanks', async (c) => {
  const space = await getSpaceBySlug(c.env.DB, c.req.param('slug'));
  if (!space) return c.notFound();
  return c.html(<ThanksPage space={space} poweredByUrl={poweredByUrl(c)} />);
});

pub.get('/w/:slug', async (c) => {
  const space = await getSpaceBySlug(c.env.DB, c.req.param('slug'));
  if (!space) return c.notFound();
  const [items, stats] = await Promise.all([listApproved(c.env.DB, space.id, 200), approvedStats(c.env.DB, space.id)]);
  return c.html(<WallPage space={space} items={items} stats={stats} poweredByUrl={poweredByUrl(c)} />);
});

export default pub;
