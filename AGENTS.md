# AGENTS.md

The setup playbook for AI coding agents (Claude Code, Codex, Cursor, …) and for anyone deploying by hand. For the product overview, see [README.md](README.md).

ProofWall is a TypeScript app (Hono, server-rendered JSX) that runs on two kinds of host. The application code is identical on both:

| Host | Database | Uploads | Daily import check | Entry point |
| --- | --- | --- | --- | --- |
| Cloudflare Workers | D1 | R2 | Cron trigger | `src/index.tsx` via Wrangler |
| Docker, or Node 22.13+ | SQLite file in `$DATA_DIR` | `$DATA_DIR/media` | Hourly timer | `dist/server.mjs` (`npm run build:node`) |

## Ground rules

- **Never** print, log, echo or commit secret values, and never write them to `wrangler.toml`, `.env.example`, `fly.toml` or any tracked file. Pass them through the host's secret manager, via a temporary file outside the repo that you delete afterwards.
- **Ask before anything that costs money**, such as a paid plan, a disk or a new server, or that changes DNS.
- **Don't add the user's domain or account IDs to tracked files.** This repo is a public template.

## 1. Ask the user

1. **Where to host.** Recommend something they already use:
   - Cloudflare, if they have an account: free, nothing to maintain, follow §2;
   - otherwise Fly.io, Railway, Render, a VPS, Coolify or Dokku, following §3.
   - Hosts without a persistent disk, such as Vercel and Netlify serverless functions, **won't work**. Explain this and offer the alternatives.
2. **Dashboard password.** Let them choose it; never invent one silently.
3. **Custom domain** (optional), for example `testimonials.example.com`.

Generate the session secret yourself (`openssl rand -hex 32`); the user doesn't need to see it.

Needed on any host:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | Dashboard password (secret) |
| `SESSION_SECRET` | yes | Signs session cookies (secret, random) |
| `POWERED_BY_URL` | no | Where the "Powered by ProofWall" badge links |

Docker/Node only: `PORT` (default `8080`), `DATA_DIR` (default `/data` in Docker, `./data` otherwise), and `PUBLIC_URL`. Set `PUBLIC_URL` to the full public URL, for example `https://testimonials.example.com`, if the proxy doesn't send `X-Forwarded-Proto` and `X-Forwarded-Host`; most PaaS hosts do. `TRUST_PROXY=false` makes the server ignore `X-Forwarded-*` headers when it's directly exposed to the internet.

## 2. Cloudflare Workers

```bash
node -v                      # need Node 20+
npm ci
npx wrangler whoami          # if not logged in: npx wrangler login (the user approves in their browser)
```

If `whoami` lists several accounts, ask which one to use and put `CLOUDFLARE_ACCOUNT_ID=<id>` in front of the commands below. R2 must be enabled once in the dashboard under **R2**. The free tier costs nothing, but Cloudflare may ask for a payment method.

```bash
SECRETS=$(mktemp) && chmod 600 "$SECRETS"
printf 'ADMIN_PASSWORD=%s\nSESSION_SECRET=%s\n' "<password from the user>" "$(openssl rand -hex 32)" > "$SECRETS"

# The first deploy creates the D1 database and R2 bucket automatically.
# Add --domain <host> only if the user gave a domain whose zone is on this account.
npx wrangler deploy --secrets-file "$SECRETS" --domain testimonials.example.com
rm -f "$SECRETS"

npx wrangler d1 migrations apply DB --remote
```

Pass the domain as a flag; don't put it in `wrangler.toml`. Later deploys without `--domain` leave it attached. If Wrangler writes a `database_id` into `wrangler.toml`, leave that uncommitted. The daily import check is the cron in `wrangler.toml` and uses one of the account's cron trigger slots.

To update later: `git pull && npm ci && npm run deploy`. This deploys, then applies any new migrations.

## 3. Docker and Node hosts

The `Dockerfile` builds a small image that listens on `$PORT` (default `8080`) and keeps all data in `/data`. **`/data` must be a persistent volume**, or every redeploy wipes the database and uploads. Migrations apply automatically on start.

### Fly.io

```bash
fly launch --no-deploy --internal-port 8080          # detects the Dockerfile and writes fly.toml
fly volumes create proofwall_data --size 1           # same region as the app
```

Add this to `fly.toml`:

```toml
[mounts]
  source = "proofwall_data"
  destination = "/data"
```

```bash
SECRETS=$(mktemp) && chmod 600 "$SECRETS"
printf 'ADMIN_PASSWORD=%s\nSESSION_SECRET=%s\n' "<password>" "$(openssl rand -hex 32)" > "$SECRETS"
fly secrets import < "$SECRETS" && rm -f "$SECRETS"
fly deploy --ha=false                                 # one machine: SQLite lives on its volume
fly certs add testimonials.example.com                # optional; then add the DNS records it prints
```

### Railway

Create a service from the repo; Railway detects the `Dockerfile`. Then:

1. Add a **Volume** mounted at `/data`.
2. Add the variables `ADMIN_PASSWORD` and `SESSION_SECRET`. Railway sets `PORT` itself.
3. Under **Networking**, generate a domain or add a custom one.

With the CLI: `railway up`, `railway volume add --mount-path /data`, then set the variables in the dashboard so they don't end up in shell history.

### Render

Create a **Web Service** from the repo with the **Docker** runtime. Add a **Disk** mounted at `/data`; disks need a paid instance type, so ask the user first. Set `ADMIN_PASSWORD` and `SESSION_SECRET` as environment variables. Render sets `PORT`.

### A VPS or home server

```bash
docker build -t proofwall .
install -m 600 /dev/null proofwall.env       # outside the repo; holds the two secrets
printf 'ADMIN_PASSWORD=%s\nSESSION_SECRET=%s\n' "<password>" "$(openssl rand -hex 32)" > proofwall.env
docker run -d --name proofwall --restart unless-stopped \
  -p 127.0.0.1:8080:8080 -v proofwall-data:/data --env-file proofwall.env proofwall
```

Put HTTPS in front with a reverse proxy, for example Caddy: `caddy reverse-proxy --from testimonials.example.com --to 127.0.0.1:8080`. **Coolify, Dokku and CapRover** work the same way: deploy from the repo with the Dockerfile, mount a persistent volume at `/data`, and set the two secrets.

### Node without Docker

Node 22.13 or later is required (it uses the built-in `node:sqlite`).

```bash
npm ci && npm run build:node
ADMIN_PASSWORD=… SESSION_SECRET=… DATA_DIR=/var/lib/proofwall PORT=8080 node dist/server.mjs
```

Keep it running with systemd, pm2 or similar, and run it from the repo root so it can find `public/` and `migrations/`.

To update a Docker or Node install: deploy the latest commit again, for example `git pull` and then rebuild or redeploy. Data stays on the volume, and new migrations apply on start.

**Backups:** copy `$DATA_DIR`, which holds `proofwall.db` and `media/`. For a consistent copy while the app is running, use `sqlite3 proofwall.db ".backup backup.db"`. On Cloudflare, D1 has 30-day Time Travel built in.

## 4. Verify (any host)

```bash
HOST=https://testimonials.example.com
curl -s -o /dev/null -w '%{http_code}\n' "$HOST/"                  # 200
curl -s "$HOST/login" | grep -o 'Welcome back'                     # both secrets are set
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -H "Origin: $HOST" \
  --data-urlencode "password=<password>" -d next=/app "$HOST/login" # 303 → /app
```

- **"Almost there"** on `/login`: a secret is missing.
- **"Database not set up yet"**: on Cloudflare, re-run the migration; on Docker or Node, check the start-up logs.
- **A 403 when signing in behind a proxy**: set `PUBLIC_URL`.
- **A new custom domain:** it can take a minute to serve HTTPS.

Finish by telling the user:
- the URL;
- that they sign in at `/login`;
- that they can change the password with `npx wrangler secret put ADMIN_PASSWORD` on Cloudflare, or by changing the host's variable elsewhere. Changing it signs out every session.

## Working on the code

```bash
cp .env.example .dev.vars      # local secrets (git-ignored)
npm run db:migrate:local
npm run seed:local             # optional sample data
npm run dev                    # Workers runtime at http://localhost:8787
npm run typecheck              # Worker, browser and Node code; must pass
```

- **Schema changes:** add a new numbered file in `migrations/`. Never edit an applied migration. Both runtimes apply them in order.
- **Pages:** server-rendered in `src/views` and must work without JavaScript. `src/client/app.ts` only adds enhancements.
- **Widget:** `src/widget/embed.ts` renders inside Shadow DOM and must insert user content as text nodes, never HTML.
- **Runtime APIs:** only use web-standard APIs in `src/` outside `src/node/`, so both runtimes keep working. D1, R2 and the cron are reached through `env`; `src/node/` provides Node versions of those.
- **Design:** use the tokens in `public/assets/app.css` (neutral greys, Geist + Newsreader, soft ring shadows). Don't add a CSS framework.
- **Testing the daily import:** `npx wrangler dev --test-scheduled`, then `curl "http://localhost:8787/cdn-cgi/handler/scheduled"`.
