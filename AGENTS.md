# AGENTS.md — working on this codebase

Instructions for AI coding agents contributing to swap.thorchain.org (the runtime guidance served to browsing agents lives at `/AGENTS.md` on the
site, generated from `src/lib/agent/discovery.ts` — this file is about the code).

## What this is

Next.js (App Router, TypeScript, Tailwind) web UI for native cross-chain swaps, powered by THORChain and Maya Protocol. Users sign in their own
wallets, or use memoless ("instant") swaps with no wallet connection.

Two-component architecture:

- **UI** — this repo.
- **Backend API** — the swap aggregator: `https://api.thorchain.org/v1` (quotes/routing, `x-api-key` gated) and
  `https://api.thorchain.org/memoless/api/v1` (memoless swaps, no key). Protocol metadata (pools, mimir, THORNames, balances) comes from
  THORNode/Midgard gateways — see `src/lib/api.ts` and `src/lib/thorchain-api.ts`.

## Commands

- `npm run dev` — dev server (Turbopack). Check whether one is already running before starting another.
- `npx tsc --noEmit -p tsconfig.json` — typecheck; this is the CI-relevant check (`next lint` is currently broken).
- `npm run build` — production build (standalone output, single instance — in-memory rate limiting and idempotency stores rely on this).

## Key areas

- `src/components/swap/` — swap flow UI; `src/lib/wallets.ts` — wallet/TCSwap SDK config (env vars in `.env.example`).
- `public/widget.js` + `src/app/widget/` — the embeddable swap iframe. The loader mirrors the host page's dark/light mode into the iframe: it reads
  the effective background painted behind the widget (so a `.dark` class, `data-theme`, or a CSS-variable swap all work without configuration), boots
  the iframe with `?theme=`, and pushes later changes over `postMessage` — `src/app/widget/theme.ts` holds that contract plus the pre-paint script
  that stops the embed flashing the wrong theme. Keep `widget.js` plain unbundled ES5-style script — it runs as-is on third-party sites.
- `src/lib/agent/discovery-files.ts` — single registry of every static discovery file (`/llms.txt`, `/AGENTS.md`, `/openapi.json`, `/.well-known/*`,
  …), served by `src/proxy.ts` before filesystem routes. Add new agent/developer surfaces here, not as route folders.
- `src/lib/agent/discovery.ts` — markdown content for `/AGENTS.md`, `/llms.txt`, `/llms-full.md`, `/auth.md`, and the agent skill;
  `src/lib/agent/openapi.ts` — the OpenAPI document.
- `src/lib/agent/developer-portal.ts` — content for `/developers.md`; `src/app/developers/page.tsx` is a hand-built HTML mirror — keep the two in
  sync.
- `src/lib/agent/developer-docs.ts` — the named developer resources at `/developers/<topic>` (quickstart, api, mcp, auth, sdks, webhooks). One
  markdown source per topic feeds both the HTML page (`src/app/developers/[topic]/page.tsx`, rendered by `src/components/markdown-article.tsx`) and
  the `.md` twin, so they cannot drift. Topic metadata lives in `developer-topics.ts` — split out so `developer-portal.ts` can link the pages without
  an import cycle.
- The MCP server is anonymous and must stay that way: publish no `/.well-known/oauth-*` metadata and no registration endpoint, and never *link* one
  from a discovery document either — a linked path reads as published metadata. MCP connectors read protected-resource metadata as "OAuth required"
  and then fail a sign-in flow against a site with no accounts — see the note in `docs/agent-readiness/orank.md`,
  `testNoAuthorizationSurfaceBlocksConnectors`, and the link guard in `testDiscoveryDocsAreTruthful` (`test/agent-contracts.test.mjs`), which also
  asserts that every own-origin URL a discovery document links resolves.
- `sdk/python`, `sdk/go` — dependency-free clients over this site's keyless public surfaces (the MCP tools and the support endpoints). The TypeScript
  SDK is the already-published [`@tcswap/sdk`](https://www.npmjs.com/package/@tcswap/sdk) from the TCSwap monorepo — do not add a second npm client
  for the same APIs. `src/lib/agent/sdks.ts` is the single list the developer docs, llms.txt, and AGENTS.md render from; PyPI publication is still a
  manual step (see `docs/agent-readiness/orank.md`).
- `src/lib/agent/skills.ts` — published agent skills (one per capability area, YAML frontmatter); routes and the skills index are generated from
  `AGENT_SKILLS`.
- `src/lib/agent/markdown-pages.ts` — markdown twins: `.md` appended to any content page URL, plus `Accept: text/markdown` negotiation, resolved in
  `src/proxy.ts`.
- `src/lib/agent/pricing.ts` — content for `/pricing.md`; `src/lib/agent/agent-mode.ts` — the `/?mode=agent` view (JSON or markdown by `Accept`),
  derived from `MCP_TOOLS` and `developerEndpoints` so it stays in sync.
- `src/lib/agent/mcp-tools.ts` — tool definitions and the server card (edge-safe, no `node:crypto`); `src/lib/agent/mcp-server.ts` +
  `src/lib/agent/mcp-ui.ts` — public MCP server at `/mcp` (stateless streamable HTTP, read-only THORNode tools, MCP Apps quote view).
  `public/robots.txt` carries AI Content-Signal lines whose ordering matters.
- `src/app/api/` — support endpoints (`/api/v1/*` canonical, unversioned aliases kept); JSON errors via `src/lib/api-error.ts`, idempotency via
  `src/lib/agent/idempotency.ts`.
- `src/lib/rate-limit.ts` — per-client limiter shared by `/mcp` and the support endpoints. Key on `cf-connecting-ip` (or the *last* forwarded hop),
  never the first `x-forwarded-for` entry: the edge appends to whatever the caller sent, so the leftmost value is forgeable.
- `src/lib/chatwoot.ts` — bug reports and feature requests are delivered into a Chatwoot **API-channel** inbox via its unauthenticated public Client
  API (`CHATWOOT_BASE_URL` + `CHATWOOT_INBOX_IDENTIFIER`); `/api/report-bug` falls back to Brevo email when Chatwoot is unset or fails.
  `src/components/chatwoot-widget.tsx` is the separate live-chat **Website-channel** widget, rendered only when `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN`
  is set. Agent replies only reach a reporter by email if the Chatwoot account has the `email_continuity_on_api_channel` feature enabled — it is off
  by default and replies are silently dropped without it.
- `server.json` (repo root) + `src/app/.well-known/mcp-registry-auth/route.ts` — the official MCP Registry record and its domain-ownership proof
  (served from `MCP_REGISTRY_AUTH`). Keep `server.json`'s `version` in step with `MCP_SERVER_INFO.version`; publishing steps are in
  `docs/agent-readiness/mcp-registry.md`.
- `docs/agent-readiness/` — notes on agent-readiness scanners and decisions; read before changing discovery surfaces.
- `src/content/banner.json` — the whole announcement banner (on/off, id, icon, link, and `locales.<locale>` copy), baked in at build time; only one
  banner is live at a time. Only the `locales.en` block is hand-written: `tools/i18n-translate.mjs` folds banner strings into its normal key space as
  `banner.<field>` and writes the other locales back into this same file, so they get the same protection as any message. New copy means a fresh `id`
  (it keys dismissals) and clearing the other locale blocks. See `docs/banner.md`.

## Conventions

- Match the surrounding code's idiom; prefer `String` methods (`includes`, `startsWith`) over regex for simple literal checks.
- i18n is cookie-based (next-intl, `NEXT_LOCALE`); do not introduce a `[lang]` URL segment — the root `[pair]` route forbids it.
- Only edit `src/i18n/messages/en.json` (and `src/content/banner.json`'s `locales.en`) by hand; every other locale is generated by
  `tools/i18n-translate.mjs`. Translations edited by native speakers
  are detected automatically and never overwritten — see `docs/localization.md` before touching the translator, the state files, or the workflow.
- `libsodium-wrappers-sumo` is pinned via `overrides` in package.json; do not bump it without checking Turbopack compatibility.
- Amounts across THORChain APIs are strings in 1e8 base units.
