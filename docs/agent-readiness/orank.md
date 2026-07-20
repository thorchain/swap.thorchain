# orank Agent-Readiness (ora.ai)

orank (https://ora.ai) scores domains on how well they support AI-agent use across Discovery, Accessibility, Usability, and Payments. Scan history for swap.thorchain.org (July 2026): 46/100 grade D → 63/100 grade C → 68/100 grade C → 70/100 grade B → 72/100 grade B.

Score page: https://ora.ai/score/swap.thorchain.org
Rescan: `POST https://ora.ai/api/scan` with `{"url": "swap.thorchain.org"}`
Cached score: `GET https://ora.ai/api/score/swap.thorchain.org`

## Gaps addressed in the codebase

- **Developer portal / developer resource discoverability** — `/developers` (HTML, `src/app/developers/page.tsx`) and `/developers.md` (markdown mirror), content in `src/lib/agent/developer-portal.ts`. Linked from llms.txt, AGENTS.md, auth.md, the agent skill, the home markdown response, the api-catalog, sitemap.xml, and the footer. Page title and headings include "THORChain Swap" for name-based search queries.
- **JSON-LD structured data** — Organization + WebSite + WebApplication graph rendered by the root layout (`src/app/layout.tsx`), so it appears on the homepage and every other page.
- **Scoped permissions** — the OpenAPI description (`src/lib/agent/openapi.ts`) now declares an `oauth2` security scheme with `read:public` and `submit:feedback` scopes matching `/.well-known/oauth-authorization-server`, applied per-operation with anonymous access still permitted. Scopes are documented in auth.md and the developer portal.
- **JSON error responses** — shared helper `src/lib/api-error.ts`; every non-2xx response from `/api/*` is JSON with `error` (message), `code` (machine-readable), `hint` (resolution), and `documentation`. Unsupported methods return JSON 405 with an `Allow` header; unknown `/api/*` paths hit the catch-all `src/app/api/[...path]/route.ts` and return JSON 404 instead of the HTML 404 page.

- **Content without JavaScript** — the homepage raw HTML had ~90 chars of text (the swap UI is client-rendered). `src/app/components/swap-page.tsx` now server-renders an `sr-only` section with an H1 and 700+ chars of accurate descriptive prose plus links to /developers, /AGENTS.md, and /llms.txt. Visually hidden to keep the consumer UI clean; present in raw HTML for crawlers and screen readers.
- **Agent instruction / when-to-use** — llms.txt gained a "When To Use THORChain Swap" section and AGENTS.md a "When To Use This Site" section (`src/lib/agent/discovery.ts`): specific fit/no-fit use cases and how to call (MCP tools, memoless flow).
- **MCP Apps support** — the MCP server implements the MCP Apps extension (spec 2026-01-26, io.modelcontextprotocol/ui): `ui://thorchain-swap/swap-quote` resource (`text/html;profile=mcp-app`, self-contained HTML in `src/lib/agent/mcp-ui.ts`), `resources/list`/`resources/read`/`resources/templates/list` methods, `_meta.ui.resourceUri` on `get_swap_quote`, and `structuredContent` in the quote tool result. Server version bumped to 0.3.0; server card advertises the resource.

- **Agent platform configs** — repo-root `AGENTS.md` with instructions for AI coding agents (the repo is public at github.com/thorchain/swap.thorchain); linked from llms.txt, the developer portal, the site AGENTS.md, and the homepage's server-rendered section so probes can find it without guessing.
- **Idempotency-Key support** — `src/lib/agent/idempotency.ts` (in-memory, single-instance deploy, 1-hour retention) wraps both POST endpoints; repeated keys replay the original response with `Idempotency-Replayed: true`. Declared as a header parameter on both operations in the OpenAPI description and documented in the developer portal.
- **REST versioning / deprecation policy** — `/api/v1/` is the canonical path prefix (`src/app/api/v1/*` re-export the handlers); unversioned `/api/*` paths remain stable aliases. Policy documented in the OpenAPI info description and the developer portal: breaking changes ship as a new `/api/vN` with ≥6 months overlap, retirement signaled via `Deprecation`/`Sunset` headers.

- **pricing.md** — `/pricing.md` (content in `src/lib/agent/pricing.ts`, registered in `discovery-files.ts`). States the honest position: the interface is free with no accounts/subscriptions/tiers, the public MCP and REST surfaces need no key, and the aggregator API is by arrangement. Per-swap costs are documented as protocol-level fees (inbound gas, outbound, liquidity, any provider service/affiliate fee) itemised in each quote rather than charged by this site. Linked from llms.txt, AGENTS.md, the agent skill, the developer portal, agents.json, the home markdown response, and sitemap.xml.
- **Agent mode view** — `https://swap.thorchain.org/?mode=agent` returns a structured view instead of the client-rendered swap UI (`src/lib/agent/agent-mode.ts`, served from `src/proxy.ts` ahead of the markdown-variant branch). JSON when the request Accepts `application/json`, markdown otherwise; both carry capabilities (with per-capability access path and auth), an explicit not-supported list, the authentication model and scopes, MCP + REST endpoints, pricing summary, asset/amount/error conventions, safety rules, and discovery links. Capabilities and endpoints are derived from `MCP_TOOLS` and `developerEndpoints`, so they cannot drift from the MCP server and developer portal. `Vary: Accept` + `no-store` because the two representations share one URL.

- **Markdown URL fallback** — `/index.md` serves the homepage markdown, and appending `.md` to any content page URL now returns that page as markdown (`src/lib/agent/markdown-pages.ts`, resolved in `src/proxy.ts` after the static registry). Covers `/` → `/index.md`, `/developers` → `/developers.md`, and every swap-pair page → `/sell-btc-buy-eth.md` (generated; mirrors the `sell-<asset>-buy-<asset>` shape of `src/app/[pair]/page.tsx`, and paths that don't match still 404 like the HTML route). All bodies are `text/markdown` and start with an H1. `Accept: text/markdown` negotiation was generalised from `/` alone to every page that has a twin.
- **Agent skills** — expanded from one skill to four, one per capability area (`src/lib/agent/skills.ts`): `thorchain-swap` (navigation/safety), `thorchain-swap-quotes` (fetching and reading quotes), `thorchain-liquidity-pools` (depths, prices, halts), `thorchain-memoless-swap` (wallet-free flow, including the failure modes worth warning a user about). Each body now carries YAML frontmatter (name, description, version, license, homepage, tags) per the agentskills.io/skills.sh convention — the previous single SKILL.md had none. Routes and `/.well-known/agent-skills/index.json` are both generated from the `AGENT_SKILLS` array, so adding a skill needs no route wiring, and each index entry carries a sha256 digest of the served body.

## Gaps deliberately not addressed

- **skills.sh listing** — the four skills above are the in-repo prerequisite, but the orank check looks for *published* skills on skills.sh, which is an external registry. Someone with an account has to submit them (they live at `https://swap.thorchain.org/.well-known/agent-skills/index.json` and each `SKILL.md` URL). No further code change helps until that submission happens.
- **UCP (Universal Commerce Protocol)** — the Payments layer is scored 0/0 (warning only). A noncustodial swap interface has no checkout: publishing `/.well-known/ucp` and a `POST /checkout-sessions` surface would advertise a commerce capability the site does not have, and the server can neither hold funds nor execute swaps for users. Skip unless the scoring changes and a genuine payment product exists.

## Gaps that cannot be fixed (or only partially) in this repo

- **Developer resource discoverability** — the check runs a live web search for "thorchain developer resources". In-repo levers have been pulled: the /developers title, H1, meta description, and intro now carry the exact phrase "THORChain developer resources"; the page ships WebPage + WebAPI + BreadcrumbList JSON-LD; sitemap.xml has lastmod dates and a higher /developers priority; and an IndexNow key is published at `/c3f786d3e23043e84baedc667c7ddbed.txt` (key file in `public/`). After each deploy that changes these pages, ping IndexNow so Bing (which powers most AI-agent search) picks them up:

  ```
  curl 'https://api.indexnow.org/indexnow?url=https://swap.thorchain.org/developers&key=c3f786d3e23043e84baedc667c7ddbed'
  ```

  Beyond that, scoring depends on search indexing and ranking (time + off-site backlinks). Submitting the sitemap in Google Search Console and Bing Webmaster Tools would also help — off-repo, needs account access.

  Progress (July 15, 2026): IndexNow ping submitted (HTTP 202) for /, /developers, /llms.txt, /AGENTS.md after the SEO changes deployed. README.md rewritten from create-next-app boilerplate to a name-rich page with "THORChain Developer Resources" and agent-resources sections — GitHub READMEs index quickly for brand-name queries (needs push to github.com/thorchain/swap.thorchain to take effect). Remaining off-repo: a linked section on docs.thorchain.org (proposal text handed to the user for the docs maintainers), Search Console / Bing Webmaster sitemap submission, and indexing lag.
- **Wikipedia / Wikidata entity presence** — requires off-site editorial work, not code:
  1. Collect independent press coverage of THORChain to satisfy Wikipedia notability.
  2. Draft a neutral, well-cited Wikipedia article (avoid self-promotion; disclose any conflict of interest per Wikipedia policy).
  3. Create a Wikidata item for THORChain with property **P856 (official website) = https://swap.thorchain.org** and link it to the article.
- **ChatGPT app listed** — off-repo submission to the GPT Store / ChatGPT app directory, needs an OpenAI account and a published app listing. The MCP server at `/mcp` is the integration surface a listing would point at; nothing further is needed in this repo.
