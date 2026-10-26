import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, Env } from './env';
import { wantsJson } from './lib/auth';
import { runDueImports } from './lib/auto-import';
import { securityHeaders } from './lib/http';
import api from './routes/api';
import auth from './routes/auth';
import dashboard from './routes/dashboard';
import media from './routes/media';
import pub from './routes/public';
import { MessagePage } from './views/pages/public';

const app = new Hono<AppEnv>();

app.use('*', securityHeaders);
// Rejects cross-site form posts (checks Origin / Sec-Fetch-Site on unsafe methods).
app.use('*', csrf());

app.route('/api/v1', api);
app.route('/media', media);
app.route('/app', dashboard);
app.route('/', auth);
app.route('/', pub);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404);
  return c.html(
    <MessagePage
      code="404"
      title="Nothing here"
      message="The page you're looking for doesn't exist, or the link may have changed."
      action={{ href: '/', label: 'Go home' }}
    />,
    404,
  );
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (wantsJson(c) || err.status !== 403) return err.getResponse();
    return c.html(
      <MessagePage
        code="403"
        title="Request blocked"
        message="This form was submitted from another site, so it was blocked for your safety. Go back, reload the page and try again."
      />,
      403,
    );
  }
  console.error(err);
  if (/no such table/i.test(String(err?.message))) {
    return c.html(
      <MessagePage
        title="Database not set up yet"
        message="ProofWall's tables don't exist yet. Run `npm run db:migrate:remote` (or `npm run db:migrate:local` in development), then reload this page."
      />,
      500,
    );
  }
  if (wantsJson(c)) return c.json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  return c.html(
    <MessagePage
      title="Something went wrong"
      message="An unexpected error occurred. Please try again in a moment."
      action={{ href: '/', label: 'Go home' }}
    />,
    500,
  );
});

export default {
  fetch: app.fetch,
  // Daily cron (see wrangler.toml): re-check saved import links for new testimonials.
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runDueImports(env));
  },
} satisfies ExportedHandler<Env>;
