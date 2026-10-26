<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
    <img src="docs/logo.svg" alt="ProofWall" height="48">
  </picture>
</p>

<p align="center">
  <strong>Collect testimonials. Show them anywhere.</strong><br>
  An open-source, self-hosted testimonial collector and Wall of Love. MIT licensed.
</p>

<p align="center">
  <a href="#deploy-with-your-ai-agent"><img src="https://img.shields.io/badge/Deploy_with_your_AI_agent-copy_the_prompt-171717?style=for-the-badge" alt="Deploy with your AI agent"></a>
</p>

![ProofWall dashboard](docs/screenshots/dashboard.jpg)

Share a link and your customers leave a rating, a few words and a photo, without signing up. You approve the ones you like, and they appear on a Wall of Love page and in a one-line embed on your site. One founder per deployment, and it fits in free tiers.

---

## Deploy with your AI agent

Paste this into Claude Code, Codex, Cursor or any coding agent that can run commands. It asks where you want to host ProofWall and what password you want, then does the rest.

```text
Deploy ProofWall for me: an open-source, self-hosted testimonial
collector.

Repository: https://github.com/QuantumCoderSys/proofwall

1. Clone the repository and read AGENTS.md. It is the setup
   playbook; follow it exactly.
2. Ask me where to host it, recommending something I already use:
   - Cloudflare Workers (free tier; uses D1 and R2), or
   - any Docker or Node 22+ host with a persistent disk
     (Fly.io, Railway, Render, a VPS, Coolify, ...).
   If I pick a host with no persistent storage (Vercel, Netlify),
   explain why it won't work and suggest one of the above.
3. Ask me for the dashboard password, and an optional custom domain.
4. Deploy with the AGENTS.md steps for that host: generate a fresh
   SESSION_SECRET, store both secrets in the host's secret manager,
   set up persistent storage, and attach my domain if I gave one.
5. Verify: the site loads over HTTPS, /login says "Welcome back",
   and signing in reaches the dashboard.

Never print, log or commit secret values. When you're done, tell
me the URL, how to sign in, and how to update later.
```

| Where it runs | Notes |
| --- | --- |
| **Cloudflare Workers** (recommended) | Free tier, global, with no server to look after. Data lives in D1 and uploads in R2. |
| **Any Docker or Node 22+ host** | Fly.io, Railway, Render, DigitalOcean, Hetzner, a home server, Coolify or Dokku. Data is a SQLite file and an uploads folder on a persistent volume. |
| ~~Vercel, Netlify~~ | Not supported: their functions have no persistent disk. |

Prefer doing it yourself? [AGENTS.md](AGENTS.md) has the exact commands for each host.

---

## What you get

- **Collection form**: mobile-first, with stars, text, name, role and photo. Photos are cropped in the browser and their location data is stripped. Customers give explicit publishing consent, and spam is filtered.
- **Moderation inbox**: approve, reject or pin in one click, without page reloads.
- **Wall of Love**: a public page for each space, with your logo and accent colour.
- **Embeds**: wall, carousel and single-card layouts in light, dark or auto themes. One script tag; your site's CSS can't break it. About 6 KB.
- **Import what you already have**: pull testimonials from review sites, posts on X and Bluesky, or your own website, and re-check those links daily. No paid APIs.
- **Spaces**: one per product, each with its own link, wall and branding.

| Collection form | Wall of Love |
| --- | --- |
| ![Collection form](docs/screenshots/collect.jpg) | ![Wall of Love](docs/screenshots/wall.jpg) |

| Moderation inbox | Embed: single card |
| --- | --- |
| ![Inbox](docs/screenshots/inbox.jpg) | ![Single card embed](docs/screenshots/embed-card.jpg) |

---

## Embed on your site

Copy your snippet from **Share & embed** in the dashboard. It looks like this:

```html
<script src="https://your-proofwall.com/embed.js" data-space="your-slug" data-layout="carousel" async></script>
```

The widget renders inside a Shadow DOM, shows **approved testimonials only**, and inserts all text as plain text, never HTML. Approvals show up within about a minute. If there's nothing approved yet, it renders nothing at all.

| Attribute | Values | Default |
| --- | --- | --- |
| `data-layout` | `wall` · `carousel` · `card` | `wall` |
| `data-theme` | `light` · `dark` · `auto` | `light` |
| `data-limit` | `1`–`100` | 50 / 20 / 10 |
| `data-id` | pin a `card` to one testimonial | — |
| `data-autoplay` | `false` to stop auto-advance | on |
| `data-font` | `inherit` to use your site's font | Geist |

You can also place `<div data-proofwall="your-slug" data-layout="wall"></div>` anywhere and load `embed.js` once, or call `window.ProofWall.mount(element, { space, layout, theme })`. On platforms that don't allow scripts, iframe the Wall of Love page at `/w/your-slug`. Approved testimonials are also available as JSON at `/api/v1/spaces/your-slug` (CORS-enabled).

---

## Import testimonials you already have

In a space, open **Import** and paste a link. ProofWall fetches the page itself, shows what it found, and lets you pick which to keep.

- **Review pages** that publish schema.org review data, such as Product Hunt, Capterra and Sitejabber
- **Posts on X and Bluesky**, through their free public embeds
- **Your own website**: `<blockquote>` testimonials and embedded posts

Tick **Check this page daily** to pick up new ones automatically. They arrive as pending, so nothing goes public without you. Sites that block bots, like G2, Yelp, Trustpilot, LinkedIn and Google reviews, can't be imported; use **Add one by hand** for those. Imported testimonials link back to the original ("via X").

---

## How it works

TypeScript throughout: [Hono](https://hono.dev) with server-rendered JSX, a tiny progressive-enhancement script, and a dependency-free widget. The same code runs on Cloudflare Workers and on Node.

| Table | Holds |
| --- | --- |
| `spaces` | Name, public slug, logo, accent colour, form wording, toggles |
| `testimonials` | Status (`pending` / `approved` / `rejected`), rating (optional for imports), text, author, photo, pinned flag, import source |
| `import_sources` · `import_skips` | Links that are re-checked daily, and deleted imports that shouldn't return |
| `rate_limits` | Login and submission throttling (hashed IPs) |

| Route | Purpose |
| --- | --- |
| `/c/:slug` | Public collection form |
| `/w/:slug` | Public Wall of Love |
| `/embed.js` · `/api/v1/spaces/:slug` | Widget and JSON API |
| `/app` | Founder dashboard (password sign-in) |

```
src/
  routes/     pages and API (auth, public, dashboard, api, media)
  views/      server-rendered JSX: design system, pages
  lib/        data access, auth, uploads, importer, rate limits
  widget/     embed.js
  client/     dashboard enhancements
  node/       Node/Docker runtime: SQLite, file storage, server
migrations/   SQL schema, applied on deploy (Cloudflare) or start (Node)
```

---

## Develop locally

```bash
npm install
cp .env.example .dev.vars        # set ADMIN_PASSWORD and SESSION_SECRET
npm run db:migrate:local
npm run seed:local               # optional sample data
npm run dev                      # http://localhost:8787
npm run typecheck
```

To run the Node build instead: `npm run build:node`, then `ADMIN_PASSWORD=… SESSION_SECRET=… npm start` (it serves on port 8080 and stores data in `./data`).

---

## Security

- **Sign-in:** one password, compared in constant time. Sessions are HMAC-signed, HttpOnly cookies, and logins are rate limited.
- **Forms and uploads:** every form is CSRF-checked by origin. Uploads are verified by their file contents, and SVG logos are sandboxed.
- **Spam:** a honeypot field plus rate limits.
- **Your data:** no third-party trackers. Visitor IPs are only stored hashed.

## License

[MIT](LICENSE)
