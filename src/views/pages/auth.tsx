import { Document } from '../document';
import { Icon, LogoMark } from '../icons';

export const LoginPage = (props: { next: string; error?: string; configured: boolean }) => (
  <Document title="Sign in · ProofWall" noindex bodyClass="public">
    <div class="dots" aria-hidden="true" />
    <main class="auth-wrap">
      <div class="auth-card">
        <a href="/" class="auth-brand" aria-label="ProofWall home">
          <LogoMark size={36} />
        </a>
        {props.configured ? (
          <>
            <h1 class="auth-title">Welcome back</h1>
            <p class="auth-sub">Sign in to review and publish your testimonials.</p>
            <form method="post" action="/login" class="form-grid" data-submit-once>
              <input type="hidden" name="next" value={props.next} />
              <input type="text" name="username" value="founder" autocomplete="username" hidden />
              <div class={props.error ? 'field has-error' : 'field'}>
                <label class="label" for="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  class="input input-lg"
                  autocomplete="current-password"
                  required
                  autofocus
                />
                {props.error && <p class="error-text">{props.error}</p>}
              </div>
              <button type="submit" class="btn btn-primary btn-lg btn-block">
                Sign in
                <Icon name="arrowRight" size={16} />
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 class="auth-title">Almost there</h1>
            <p class="auth-sub">
              Set two secrets to finish setting up ProofWall, then reload this page.
            </p>
            <pre class="code code-block">
              {`npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET`}
            </pre>
            <p class="hint auth-hint">
              Running locally? Copy <code>.env.example</code> to <code>.dev.vars</code> and restart{' '}
              <code>npm run dev</code>.
            </p>
          </>
        )}
      </div>
      <p class="auth-foot">
        <Icon name="lock" size={12} /> Self-hosted on your own Cloudflare account
      </p>
    </main>
  </Document>
);

export const LandingPage = (props: { signedIn: boolean }) => (
  <Document
    title="ProofWall — Collect testimonials. Show them anywhere."
    description="A self-hosted, open-source testimonial collector and Wall of Love. Runs on Cloudflare Workers."
    bodyClass="public"
  >
    <div class="dots dots-tall" aria-hidden="true" />
    <header class="landing-nav">
      <a href="/" class="brand">
        <LogoMark size={22} />
        <span>ProofWall</span>
      </a>
      <a class="btn btn-primary btn-sm" href={props.signedIn ? '/app' : '/login'}>
        {props.signedIn ? 'Open dashboard' : 'Sign in'}
      </a>
    </header>
    <main>
      <section class="hero">
        <p class="eyebrow">Open source · Self-hosted</p>
        <h1 class="display">
          Collect testimonials.
          <br />
          <span class="mark">Show them anywhere.</span>
        </h1>
        <p class="hero-sub">
          Share a link, approve the best words your customers write, and embed them on your site with a single
          script tag.
        </p>
        <a class="btn btn-primary btn-lg" href={props.signedIn ? '/app' : '/login'}>
          {props.signedIn ? 'Open dashboard' : 'Sign in to your dashboard'}
          <Icon name="arrowRight" size={16} />
        </a>
      </section>
      <section class="features">
        <div class="card feature">
          <div class="feature-icon">
            <Icon name="link" />
          </div>
          <h3>Collect with a link</h3>
          <p>A beautiful, mobile-friendly form. Ratings, words and photos — no account needed.</p>
        </div>
        <div class="card feature">
          <div class="feature-icon">
            <Icon name="check" />
          </div>
          <h3>Approve what's shown</h3>
          <p>Every submission waits in your inbox. Nothing goes public until you say so.</p>
        </div>
        <div class="card feature">
          <div class="feature-icon">
            <Icon name="code" />
          </div>
          <h3>Embed anywhere</h3>
          <p>A Wall of Love page, plus wall, carousel and card widgets for any website.</p>
        </div>
      </section>
    </main>
  </Document>
);
