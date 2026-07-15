# AGENTS.md — working on this codebase

Instructions for AI coding agents contributing to swap.thorchain.org (the runtime guidance served to browsing agents lives at `/AGENTS.md` on the site, generated from `src/lib/agent/discovery.ts` — this file is about the code).

## What this is

Next.js (App Router, TypeScript, Tailwind) web UI for native cross-chain swaps, powered by THORChain and Maya Protocol. Users sign in their own wallets, or use memoless ("instant") swaps with no wallet connection.

Two-component architecture:

- **UI** — this repo.
- **Backend API** — the swap aggregator: `https://api.thorchain.org/v1` (quotes/routing, `x-api-key` gated) and `https://api.thorchain.org/memoless/api/v1` (memoless swaps, no key). Protocol metadata (pools, mimir, THORNames, balances) comes from THORNode/Midgard gateways — see `src/lib/api.ts` and `src/lib/thorchain-api.ts`.

## Commands

- `npm run dev` — dev server (Turbopack). Check whether one is already running before starting another.
- `npx tsc --noEmit -p tsconfig.json` — typecheck; this is the CI-relevant check (`next lint` is currently broken).
- `npm run build` — production build (standalone output, single instance — in-memory rate limiting and idempotency stores rely on this).

## Key areas

- `src/components/swap/` — swap flow UI; `src/lib/wallets.ts` — wallet/TCSwap SDK config (env vars in `.env.example`).
- `src/lib/agent/discovery-files.ts` — single registry of every static discovery file (`/llms.txt`, `/AGENTS.md`, `/openapi.json`, `/.well-known/*`, …), served by `src/proxy.ts` before filesystem routes. Add new agent/developer surfaces here, not as route folders.
- `src/lib/agent/discovery.ts` — markdown content for `/AGENTS.md`, `/llms.txt`, `/llms-full.md`, `/auth.md`, and the agent skill; `src/lib/agent/openapi.ts` — the OpenAPI document.
- `src/lib/agent/developer-portal.ts` — content for `/developers.md`; `src/app/developers/page.tsx` is a hand-built HTML mirror — keep the two in sync.
- `src/lib/agent/mcp-server.ts` + `src/lib/agent/mcp-ui.ts` — public MCP server at `/mcp` (stateless streamable HTTP, read-only THORNode tools, MCP Apps quote view). `public/robots.txt` carries AI Content-Signal lines whose ordering matters.
- `src/app/api/` — support endpoints (`/api/v1/*` canonical, unversioned aliases kept); JSON errors via `src/lib/api-error.ts`, idempotency via `src/lib/agent/idempotency.ts`.
- `docs/agent-readiness/` — notes on agent-readiness scanners and decisions; read before changing discovery surfaces.

## Conventions

- Match the surrounding code's idiom; prefer `String` methods (`includes`, `startsWith`) over regex for simple literal checks.
- i18n is cookie-based (next-intl, `NEXT_LOCALE`); do not introduce a `[lang]` URL segment — the root `[pair]` route forbids it.
- `libsodium-wrappers-sumo` is pinned via `overrides` in package.json; do not bump it without checking Turbopack compatibility.
- Amounts across THORChain APIs are strings in 1e8 base units.
