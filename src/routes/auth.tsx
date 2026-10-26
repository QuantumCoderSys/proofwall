import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { authConfigured, endSession, hasSession, passwordMatches, safeNext, startSession } from '../lib/auth';
import { field } from '../lib/http';
import { clientIp, rateLimit } from '../lib/rate-limit';
import { LoginPage } from '../views/pages/auth';

const auth = new Hono<AppEnv>();

auth.get('/login', async (c) => {
  const next = safeNext(c.req.query('next'));
  if (await hasSession(c)) return c.redirect(next);
  return c.html(<LoginPage next={next} configured={authConfigured(c.env)} />);
});

auth.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const next = safeNext(field(body, 'next'));
  if (!authConfigured(c.env)) return c.redirect('/login', 303);

  const allowed = await rateLimit(c.env.DB, 'login', clientIp(c.req.raw.headers), 10, 15 * 60);
  if (!allowed) {
    return c.html(
      <LoginPage next={next} configured error="Too many attempts. Please wait 15 minutes and try again." />,
      429,
    );
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!(await passwordMatches(c.env, password))) {
    return c.html(<LoginPage next={next} configured error="That password didn't match. Try again." />, 401);
  }

  await startSession(c);
  return c.redirect(next, 303);
});

auth.post('/logout', (c) => {
  endSession(c);
  return c.redirect('/login', 303);
});

export default auth;
