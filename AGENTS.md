# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repo. Humans: see [README.md](README.md).

ProofWall is a TypeScript Cloudflare Worker (Hono + server-rendered `hono/jsx`) backed by D1 (SQLite) and R2. Browser code lives in `src/client` and `src/widget` and is bundled by `scripts/build-client.mjs`, which Wrangler runs automatically before `dev` and `deploy`.

## Setting ProofWall up for a user

Follow these steps in order. Ask the user before anything that costs money, changes DNS, or needs a decision only they can make.

### 1. Ask first

Collect these before deploying:

1. **Dashboard password**: ask the user to choose it. Never invent one silently.
2. **Custom domain** (optional), for example `testimonials.example.com`. Its parent domain must be an active zone in the same Cloudflare account. Without one, the app lives at `https://proofwall.<subdomain>.workers.dev`.
3. **Cloudflare account**: only matters if `npx wrangler whoami` lists more than one.

### 2. Prerequisites

```bash
node -v                # need Node 20+
npm install
npx wrangler whoami    # if not logged in: npx wrangler login (the user approves in their browser)
```

R2 must be enabled on the account. That's a one-time step in the Cloudflare dashboard under **R2**; the free tier costs nothing, but Cloudflare may ask for a payment method on file. If `wrangler deploy` reports that R2 isn't enabled, tell the user and wait.

### 3. Deploy

The first deploy creates the D1 database (`proofwall`) and the R2 bucket (`proofwall-media`), then uploads the secrets in one step. Keep the secrets file outside the repo, readable only by the user, and delete it afterwards:

```bash
SECRETS=$(mktemp)            # outside the repo
chmod 600 "$SECRETS"
printf 'ADMIN_PASSWORD=%s\nSESSION_SECRET=%s\n' "<password from the user>" "$(openssl rand -hex 32)" > "$SECRETS"

# Add --domain <host> only if the user gave a custom domain.
# Add CLOUDFLARE_ACCOUNT_ID=<id> in front if they have several accounts.
npx wrangler deploy --secrets-file "$SECRETS" --domain testimonials.example.com
rm -f "$SECRETS"

npx wrangler d1 migrations apply DB --remote
```

Rules:

- **Never** print, log, echo or commit secret values, and never write them to `wrangler.toml`, `.env.example` or any tracked file.
- Pass the custom domain with `--domain`. **Don't** add it to `wrangler.toml`: this repo is a public template and the Deploy button must keep working for everyone. Later deploys without `--domain` leave the domain attached.
- If Wrangler writes `database_id` back into `wrangler.toml`, leave it uncommitted unless the user asks otherwise.

### 4. Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/                       # 200
curl -s https://<host>/login | grep -o 'Welcome back'                          # secrets are set
npx wrangler secret list                                                       # ADMIN_PASSWORD + SESSION_SECRET, type secret_text
```

A fresh custom domain can take a minute to serve HTTPS. If `/login` says **"Almost there"**, a secret is missing. If a page says **"Database not set up yet"**, run the migration step again.

Finish by telling the user the URL, that they sign in at `/login`, and how to change the password later: `npx wrangler secret put ADMIN_PASSWORD`, which also signs out every session.

### Updating an existing install

```bash
git pull && npm install && npm run deploy   # deploys, then applies any new migrations
```

## Working on the code

```bash
cp .env.example .dev.vars      # local secrets (git-ignored)
npm run db:migrate:local
npm run seed:local             # optional sample data
npm run dev                    # http://localhost:8787
npm run typecheck              # must pass before you finish
```

- **Schema changes:** add a new numbered file in `migrations/`. Never edit an applied migration.
- **Pages:** server-rendered in `src/views` and must work without JavaScript. `src/client/app.ts` only adds enhancements.
- **Widget:** `src/widget/embed.ts` renders inside Shadow DOM and must insert user content as text nodes, never HTML.
- **Design:** use the tokens in `public/assets/app.css` (neutral greys, Geist + Newsreader, soft ring shadows). Don't add a CSS framework.
- **Dev server reloads:** if `wrangler dev` doesn't pick up an edit, restart it.
- **Cron:** test the daily import job locally with `npx wrangler dev --test-scheduled`, then `curl "http://localhost:8787/cdn-cgi/handler/scheduled"`.
