import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth, safeNext, wantsJson } from '../lib/auth';
import { DEFAULT_ACCENT, normalizeHex } from '../lib/color';
import { checkSource } from '../lib/auto-import';
import {
  addSource,
  deleteSource,
  deleteSpace,
  deleteTestimonial,
  getSource,
  getSpace,
  getTestimonial,
  insertImported,
  insertSpace,
  listSources,
  listSpaceSummaries,
  listTestimonials,
  recentPending,
  setFeatured,
  setStatus,
  slugTaken,
  STATUSES,
  updateSpace,
  type ImportedInput,
  type Status,
} from '../lib/db';
import { field, originOf } from '../lib/http';
import { newId, SLUG_PATTERN, slugify } from '../lib/ids';
import { extractFromUrl, ImportError, isSinglePost, parseImportUrl, sanitizeCandidate } from '../lib/importer';
import { deleteMedia, isFile, storeImage } from '../lib/uploads';
import { toastMessage } from '../views/document';
import { OverviewPage } from '../views/pages/overview';
import { SpaceImportPage, type ManualErrors, type ManualValues } from '../views/pages/space-import';
import { SpaceInboxPage, type InboxFilter } from '../views/pages/space-inbox';
import { NewSpacePage, type NewSpaceErrors } from '../views/pages/space-new';
import { SpaceSettingsPage, type SettingsErrors, type SettingsValues } from '../views/pages/space-settings';
import { SpaceSharePage } from '../views/pages/space-share';

const dashboard = new Hono<AppEnv>();
dashboard.use('*', requireAuth);

async function shell(c: Context<AppEnv>) {
  return {
    host: new URL(c.req.url).host,
    origin: originOf(c),
    spaces: await listSpaceSummaries(c.env.DB),
    toast: c.req.query('t'),
  };
}

/** Finish a mutation: JSON for the enhanced UI, otherwise redirect back with a toast. */
function done(c: Context<AppEnv>, next: unknown, toast: string, fallback = '/app') {
  if (wantsJson(c)) return c.json({ ok: true, toast: toastMessage(toast) });
  const url = new URL(safeNext(next, fallback), 'http://local');
  url.searchParams.set('t', toast);
  return c.redirect(url.pathname + url.search, 303);
}

function fail(c: Context<AppEnv>, message: string, status: 400 | 404) {
  if (wantsJson(c)) return c.json({ ok: false, error: message }, status);
  return c.text(message, status);
}

// ── Overview ──────────────────────────────────────────────────────────────

dashboard.get('/', async (c) => {
  const [base, pending] = await Promise.all([shell(c), recentPending(c.env.DB, 6)]);
  return c.html(<OverviewPage host={base.host} spaces={base.spaces} pending={pending} toast={base.toast} />);
});

// ── Spaces ────────────────────────────────────────────────────────────────

dashboard.get('/spaces/new', async (c) => {
  const base = await shell(c);
  return c.html(<NewSpacePage host={base.host} spaces={base.spaces} />);
});

dashboard.post('/spaces', async (c) => {
  const body = await c.req.parseBody();
  const name = field(body, 'name');
  const accent = normalizeHex(field(body, 'accent_color'));
  const errors: NewSpaceErrors = {};
  if (!name) errors.name = 'Give your space a name.';
  else if (name.length > 60) errors.name = 'Please keep the name under 60 characters.';
  if (!accent) errors.accentColor = 'Use a hex colour like #2563eb.';

  let logoKey: string | null = null;
  if (Object.keys(errors).length === 0 && isFile(body.logo) && body.logo.size > 0) {
    const upload = await storeImage(c.env, body.logo, 'logos');
    if ('error' in upload) errors.logo = upload.error;
    else logoKey = upload.key;
  }

  if (Object.keys(errors).length > 0) {
    const base = await shell(c);
    return c.html(
      <NewSpacePage
        host={base.host}
        spaces={base.spaces}
        values={{ name, accentColor: accent ?? DEFAULT_ACCENT }}
        errors={errors}
      />,
      422,
    );
  }

  const root = slugify(name) || 'space';
  let slug = root;
  while (await slugTaken(c.env.DB, slug)) slug = `${root}-${newId(4).toLowerCase()}`;

  const id = newId(12);
  await insertSpace(c.env.DB, id, {
    slug,
    name,
    logoKey,
    accentColor: accent ?? DEFAULT_ACCENT,
    headline: '',
    prompt: '',
    thankYou: '',
    collectPhoto: true,
    isAccepting: true,
    showBranding: true,
  });
  return c.redirect(`/app/spaces/${id}/share?t=created`, 303);
});

dashboard.get('/spaces/:id', async (c) => {
  const [base, space] = await Promise.all([shell(c), getSpace(c.env.DB, c.req.param('id'))]);
  if (!space) return c.notFound();

  const requested = c.req.query('status');
  const summary = base.spaces.find((s) => s.id === space.id);
  const filter: InboxFilter =
    requested === 'all' || STATUSES.includes(requested as Status)
      ? (requested as InboxFilter)
      : summary && summary.pending > 0
        ? 'pending'
        : 'all';
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const { items, hasMore } = await listTestimonials(c.env.DB, space.id, filter, page);

  return c.html(
    <SpaceInboxPage {...base} space={space} filter={filter} page={page} items={items} hasMore={hasMore} />,
  );
});

dashboard.get('/spaces/:id/share', async (c) => {
  const [base, space] = await Promise.all([shell(c), getSpace(c.env.DB, c.req.param('id'))]);
  if (!space) return c.notFound();
  return c.html(<SpaceSharePage {...base} space={space} />);
});

dashboard.get('/spaces/:id/settings', async (c) => {
  const [base, space] = await Promise.all([shell(c), getSpace(c.env.DB, c.req.param('id'))]);
  if (!space) return c.notFound();
  return c.html(<SpaceSettingsPage {...base} space={space} />);
});

dashboard.post('/spaces/:id/settings', async (c) => {
  const space = await getSpace(c.env.DB, c.req.param('id'));
  if (!space) return c.notFound();
  const body = await c.req.parseBody();

  const accent = normalizeHex(field(body, 'accent_color'));
  const values: SettingsValues = {
    name: field(body, 'name'),
    slug: field(body, 'slug').toLowerCase(),
    accentColor: accent ?? field(body, 'accent_color'),
    headline: field(body, 'headline'),
    prompt: field(body, 'prompt'),
    thankYou: field(body, 'thank_you'),
    collectPhoto: field(body, 'collect_photo') === '1',
    isAccepting: field(body, 'is_accepting') === '1',
    showBranding: field(body, 'show_branding') === '1',
  };

  const errors: SettingsErrors = {};
  if (!values.name) errors.name = 'Give your space a name.';
  else if (values.name.length > 60) errors.name = 'Please keep the name under 60 characters.';
  if (!SLUG_PATTERN.test(values.slug)) errors.slug = 'Use lowercase letters, numbers and dashes (max 48).';
  else if (await slugTaken(c.env.DB, values.slug, space.id)) errors.slug = 'Another space already uses this URL.';
  if (!accent) errors.accentColor = 'Use a hex colour like #2563eb.';
  if (values.headline.length > 120) errors.headline = 'Please keep the headline under 120 characters.';
  if (values.prompt.length > 500) errors.prompt = 'Please keep the prompt under 500 characters.';
  if (values.thankYou.length > 300) errors.thankYou = 'Please keep this under 300 characters.';

  let logoKey = space.logoKey;
  if (Object.keys(errors).length === 0) {
    if (isFile(body.logo) && body.logo.size > 0) {
      const upload = await storeImage(c.env, body.logo, 'logos');
      if ('error' in upload) errors.logo = upload.error;
      else logoKey = upload.key;
    } else if (field(body, 'remove_logo') === '1') {
      logoKey = null;
    }
  }

  if (Object.keys(errors).length > 0) {
    const base = await shell(c);
    return c.html(<SpaceSettingsPage {...base} space={space} values={values} errors={errors} />, 422);
  }

  await updateSpace(c.env.DB, space.id, { ...values, accentColor: accent!, logoKey });
  if (logoKey !== space.logoKey) await deleteMedia(c.env, [space.logoKey]);
  return c.redirect(`/app/spaces/${space.id}/settings?t=saved`, 303);
});

dashboard.post('/spaces/:id/delete', async (c) => {
  const keys = await deleteSpace(c.env.DB, c.req.param('id'));
  await deleteMedia(c.env, keys);
  return c.redirect('/app?t=space-deleted', 303);
});

// ── Testimonials ──────────────────────────────────────────────────────────

dashboard.post('/testimonials/:id/status', async (c) => {
  const body = await c.req.parseBody();
  const status = field(body, 'status') as Status;
  if (!STATUSES.includes(status)) return fail(c, 'Unknown status.', 400);
  const t = await getTestimonial(c.env.DB, c.req.param('id'));
  if (!t) return fail(c, 'That testimonial no longer exists.', 404);
  await setStatus(c.env.DB, t.id, status);
  return done(c, body.next, status, `/app/spaces/${t.spaceId}`);
});

dashboard.post('/testimonials/:id/feature', async (c) => {
  const body = await c.req.parseBody();
  const featured = field(body, 'featured') === '1';
  const t = await getTestimonial(c.env.DB, c.req.param('id'));
  if (!t) return fail(c, 'That testimonial no longer exists.', 404);
  await setFeatured(c.env.DB, t.id, featured);
  return done(c, body.next, featured ? 'featured' : 'unfeatured', `/app/spaces/${t.spaceId}`);
});

dashboard.post('/testimonials/:id/delete', async (c) => {
  const body = await c.req.parseBody();
  const t = await getTestimonial(c.env.DB, c.req.param('id'));
  if (!t) return fail(c, 'That testimonial no longer exists.', 404);
  await deleteTestimonial(c.env.DB, t);
  await deleteMedia(c.env, [t.photoKey]);
  return done(c, body.next, 'deleted', `/app/spaces/${t.spaceId}`);
});

// ── Imports ───────────────────────────────────────────────────────────────

async function importPage(c: Context<AppEnv>, spaceId: string) {
  const [base, space, sources] = await Promise.all([
    shell(c),
    getSpace(c.env.DB, spaceId),
    listSources(c.env.DB, spaceId),
  ]);
  return space ? { ...base, space, sources } : null;
}

dashboard.get('/spaces/:id/import', async (c) => {
  const page = await importPage(c, c.req.param('id'));
  if (!page) return c.notFound();
  return c.html(<SpaceImportPage {...page} />);
});

/** Fetches the link and shows what was found, without saving anything yet. */
dashboard.post('/spaces/:id/import/preview', async (c) => {
  const page = await importPage(c, c.req.param('id'));
  if (!page) return c.notFound();
  const url = field(await c.req.parseBody(), 'url');
  try {
    const preview = await extractFromUrl(url, page.host);
    return c.html(<SpaceImportPage {...page} url={url} preview={preview} watchable={!isSinglePost(url)} />);
  } catch (err) {
    if (!(err instanceof ImportError)) throw err;
    return c.html(<SpaceImportPage {...page} url={url} error={err.message} />, 422);
  }
});

/** Saves the testimonials picked from a preview, or one added by hand. */
dashboard.post('/spaces/:id/import', async (c) => {
  const space = await getSpace(c.env.DB, c.req.param('id'));
  if (!space) return c.notFound();
  const body = await c.req.parseBody({ all: true });
  const status: Status = field(body, 'status') === 'approved' ? 'approved' : 'pending';
  let items: ImportedInput[] = [];

  if (field(body, 'manual') === '1') {
    const values: ManualValues = {
      body: field(body, 'body').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n'),
      name: field(body, 'name'),
      role: field(body, 'role'),
      rating: field(body, 'rating'),
      sourceUrl: field(body, 'source_url'),
      status,
    };
    const errors: ManualErrors = {};
    const rating = values.rating ? Number(values.rating) : null;
    if (values.body.length < 10) errors.body = 'Paste at least a sentence or two.';
    else if (values.body.length > 2000) errors.body = 'Please keep it under 2,000 characters.';
    if (values.name.length > 80) errors.name = 'Please keep the name under 80 characters.';
    if (values.role.length > 100) errors.role = 'Please keep this under 100 characters.';
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) errors.rating = 'Pick a rating.';
    let sourceUrl: string | null = null;
    if (values.sourceUrl) {
      try {
        sourceUrl = parseImportUrl(values.sourceUrl);
      } catch (err) {
        errors.sourceUrl = err instanceof ImportError ? err.message : 'That link looks wrong.';
      }
    }
    if (Object.keys(errors).length > 0) {
      const page = await importPage(c, space.id);
      return c.html(<SpaceImportPage {...page!} manual={values} manualErrors={errors} />, 422);
    }
    items = [
      {
        body: values.body,
        name: values.name || null,
        role: values.role || null,
        rating,
        source: sourceUrl ? 'web' : null,
        sourceUrl,
        externalId: `manual:${newId()}`,
        createdAt: Date.now(),
      },
    ];
  } else {
    const picked = body.item;
    const raw = Array.isArray(picked) ? picked : picked ? [picked] : [];
    for (const value of raw) {
      try {
        const candidate = sanitizeCandidate(JSON.parse(String(value)));
        if (candidate) items.push(candidate);
      } catch {
        // Ignore anything that didn't round-trip cleanly.
      }
    }
    const watch = field(body, 'watch') === '1' ? field(body, 'url') : '';
    if (watch && !isSinglePost(watch)) {
      try {
        await addSource(c.env.DB, space.id, parseImportUrl(watch, new URL(c.req.url).host));
      } catch (err) {
        if (!(err instanceof ImportError)) throw err;
      }
    }
  }

  const added = await insertImported(c.env.DB, space.id, items, status);
  const toast =
    field(body, 'manual') === '1'
      ? 'added'
      : items.length === 0
        ? 'nothing-selected'
        : added === 0
          ? 'nothing-new'
          : status === 'approved'
            ? 'imported-approved'
            : 'imported';
  const filter = added > 0 ? status : 'all';
  return c.redirect(`/app/spaces/${space.id}?status=${filter}&t=${toast}`, 303);
});

dashboard.post('/sources/:id/run', async (c) => {
  const body = await c.req.parseBody();
  const source = await getSource(c.env.DB, c.req.param('id'));
  if (!source) return fail(c, 'That link is no longer being checked.', 404);
  const result = await checkSource(c.env, source);
  if (wantsJson(c)) {
    const message = result.added > 0 ? `Added ${result.added} new — they're waiting for review` : result.status;
    return c.json({ ok: true, toast: message });
  }
  return done(c, body.next, 'checked', `/app/spaces/${source.spaceId}/import`);
});

dashboard.post('/sources/:id/delete', async (c) => {
  const body = await c.req.parseBody();
  const source = await getSource(c.env.DB, c.req.param('id'));
  if (!source) return fail(c, 'That link is no longer being checked.', 404);
  await deleteSource(c.env.DB, source.id);
  return done(c, body.next, 'source-removed', `/app/spaces/${source.spaceId}/import`);
});

export default dashboard;
