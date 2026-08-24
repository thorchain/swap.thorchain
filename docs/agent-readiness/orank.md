# orank Agent-Readiness (ora.ai)

orank (https://ora.ai) scores domains on how well they support AI-agent use across Discovery, Accessibility, Usability, and Payments. Scan history for
swap.thorchain.org (July 2026): 46/100 grade D → 63/100 grade C → 68/100 grade C → 70/100 grade B → 72/100 grade B.

Score page: https://ora.ai/score/swap.thorchain.org Rescan: `POST https://ora.ai/api/scan` with `{"url": "swap.thorchain.org"}` Cached score:
`GET https://ora.ai/api/score/swap.thorchain.org`

## Gaps addressed in the codebase

- **Developer portal / developer resource discoverability** — `/developers` (HTML, `src/app/developers/page.tsx`) and `/developers.md` (markdown
  mirror), content in `src/lib/agent/developer-portal.ts`. Linked from llms.txt, AGENTS.md, auth.md, the agent skill, the home markdown response, the
  api-catalog, sitemap.xml, and the footer. Page title and headings include "THORChain Swap" for name-based search queries.
- **JSON-LD structured data** — Organization + WebSite + WebApplication graph rendered by the root layout (`src/app/layout.tsx`), so it appears on the
  homepage and every other page.
- **MCP parameter schemas (August 2026)** — `list_pools` and `get_network_status` had empty `properties: {}`. Both now take real, implemented
  parameters: `list_pools(status, asset, limit)` filters and caps the listing by RUNE depth, and `get_network_status(fields)` projects the response to
  the keys an agent actually watches. Every tool declares an explicit `required` array, and each property carries a type and a description.
- **MCP manifest endpoint (August 2026)** — the server card is now reachable from every path a scanner tries: `/.well-known/mcp/server-card.json`
  (canonical), `/.well-known/mcp.json`, `/.well-known/mcp/manifest.json`, `/mcp.json`, and `GET /mcp` itself. A `GET` that asks for
  `text/event-stream` still returns the 405 the stateless streamable-HTTP transport requires. The card and the endpoint share one definition in
  `src/lib/agent/mcp-tools.ts`, and the endpoint answers CORS preflights so browser-based agents can call it.
- **ARD trust manifest (August 2026)** — every `/.well-known/ai-catalog.json` entry, plus the catalog host, carries a `trustManifest` with a
  domain-bound `identity` (verification method `https-origin`, evidence URLs on this origin), `attestations` explicitly typed `self-attested`, a
  `policy` block (ToS, privacy, contact, retention), and `signature: null`. Nothing claims a signature, third-party audit, or DID the deployment does
  not produce — the contract test asserts exactly that.
- **Named developer resources (August 2026)** — `/developers/quickstart`, `/developers/api`, `/developers/mcp`, `/developers/auth`,
  `/developers/sdks`, `/developers/webhooks`, each with a `.md` twin, its own `TechArticle` + breadcrumb JSON-LD, a product-name-bearing `<title>` and
  H1, and entries in llms.txt, AGENTS.md, the API catalog `service-doc` links, agents.json, and sitemap.xml. `/docs`, `/api-docs`, `/documentation`,
  `/developer`, `/sdk`, `/sdks`, and `/quickstart` redirect into them so a name-based guess lands on documentation.
- **SDK packages (August 2026)** — the npm slot is already filled by [`@tcswap/sdk`](https://www.npmjs.com/package/@tcswap/sdk) (published from the
  TCSwap monorepo — the SDK this interface is built on); do not publish a second TypeScript client for the same APIs. Added alongside it: `sdk/python`
  (`thorchain-swap`) and `sdk/go` (`github.com/thorchain/swap.thorchain/sdk/go`), dependency-free clients over the MCP tools and the REST support
  endpoints. `src/lib/agent/sdks.ts` is the one list the SDK page, llms.txt, AGENTS.md, and the developer portal render from. **PyPI publication is
  the remaining manual step** (see below).
- **Truthful access metadata** — the OpenAPI description (`src/lib/agent/openapi.ts`) declares anonymous access for the public, rate-limited support
  APIs; `auth.md`, the developer portal, and `/developers/auth` document the same model: no credential is issued or accepted, and the aggregator
  `x-api-key` is a separate system reached through the affiliate program. There is no OAuth on this site — see "Gaps deliberately not addressed"
  below for why the client-credentials tier was reverted. The invariant behind the contract tests is unchanged: nothing is advertised unless it is
  implemented, so the suite asserts that every URL a discovery document links resolves, and that no document links an authorization surface.
- **JSON error responses** — shared helper `src/lib/api-error.ts`; every non-2xx response from `/api/*` is JSON with `error` (message), `code`
  (machine-readable), `hint` (resolution), and `documentation`. Unsupported methods return JSON 405 with an `Allow` header; unknown `/api/*` paths hit
  the catch-all `src/app/api/[...path]/route.ts` and return JSON 404 instead of the HTML 404 page.

- **Content without JavaScript** — the homepage raw HTML had ~90 chars of text (the swap UI is client-rendered). `src/app/components/swap-page.tsx`
  now server-renders an `sr-only` section with an H1 and 700+ chars of accurate descriptive prose plus links to /developers, /AGENTS.md, and
  /llms.txt. Visually hidden to keep the consumer UI clean; present in raw HTML for crawlers and screen readers.
- **Agent instruction / when-to-use** — llms.txt gained a "When To Use THORChain Swap" section and AGENTS.md a "When To Use This Site" section
  (`src/lib/agent/discovery.ts`): specific fit/no-fit use cases and how to call (MCP tools, memoless flow).
- **MCP Apps support** — the MCP server implements the MCP Apps extension (spec 2026-01-26, io.modelcontextprotocol/ui):
  `ui://thorchain-swap/swap-quote` resource (`text/html;profile=mcp-app`, self-contained HTML in `src/lib/agent/mcp-ui.ts`),
  `resources/list`/`resources/read`/`resources/templates/list` methods, `_meta.ui.resourceUri` on `get_swap_quote`, and `structuredContent` in the
  quote tool result. Server version bumped to 0.3.0; server card advertises the resource.

- **Manifest paths speak the transport (August 24, 2026)** — the 88/100 scan reported "MCP manifest found at `/.well-known/mcp/manifest.json` but
  protocol handshake failed" while every other MCP check passed against `/mcp`. The check handshakes against the manifest URL it discovered, and the
  card aliases were served from the discovery-file registry, which answers `GET`/`HEAD` only — a POST fell through to the HTML 404 page. `src/proxy.ts`
  now rewrites `POST`/`OPTIONS` on every alias in `MCP_ENDPOINT_ALIASES` (`src/lib/agent/mcp-tools.ts`) to `/mcp`, so a client that finds any of them
  and posts JSON-RPC reaches the server; `GET` still returns the card. Pinned by `testMcpManifestIsReachableFromEveryStandardPath`. Note the two
  registry checks (`mcp-registry-listed`, `mcp-registry-metadata`) read **Smithery and mcp.so**, not `registry.modelcontextprotocol.io` — the official
  listing does not satisfy them directly, though mcp.so mirrors the official registry.
- **WebMCP entry point (August 24, 2026)** — `src/components/webmcp-tools.tsx` registered on `navigator.modelContext`; the entry point has moved to
  `document.modelContext` and Chrome 150+ deprecates the alias. It now prefers `document.modelContext` and falls back to the navigator alias.
- **MCP correctness pass (August 24, 2026)** — from the audit of the agent-readiness branch: `list_pools`'s `asset` filter was a substring match, so a
  bare chain filter (`ETH`) also returned `BASE.ETH` and `BSC.ETH-0X21…`; it now matches the chain segment, and a `CHAIN.SYMBOL` filter matches by
  prefix. A wrong-typed `fields` on `get_network_status` silently returned the whole object instead of `-32602`. JSON-RPC batches were rejected
  outright even though the server offers to negotiate 2025-03-26 and 2024-11-05, where a batch is valid; arrays are now answered with arrays.
  `/pools` and `/network` are served from a 6-second in-process cache (quotes never are). The contract suite covers each of these, plus a local
  assertion that `server.json`'s version matches `MCP_SERVER_INFO.version`, and `HOST_HEADER` now works — Node's fetch drops a `Host` header, so the
  suite could not be pointed at a local server before, which is what made it a post-deploy check only. Separately, `src/lib/rate-limit.ts` keyed on
  the *first* `x-forwarded-for` hop — Cloudflare appends the real client IP to whatever the caller sent, so that entry is forgeable and rotating it
  gave an unlimited number of buckets (confirmed against production). It now keys on `cf-connecting-ip`, falling back to the last forwarded hop.
- **Agent platform configs** — repo-root `AGENTS.md` with instructions for AI coding agents (the repo is public at
  github.com/thorchain/swap.thorchain); linked from llms.txt, the developer portal, the site AGENTS.md, and the homepage's server-rendered section so
  probes can find it without guessing.
- **Idempotency-Key support** — `src/lib/agent/idempotency.ts` (in-memory, single-instance deploy, 1-hour retention) wraps both POST endpoints;
  repeated keys replay the original response with `Idempotency-Replayed: true`. Declared as a header parameter on both operations in the OpenAPI
  description and documented in the developer portal.
- **REST versioning / deprecation policy** — `/api/v1/` is the canonical path prefix (`src/app/api/v1/*` re-export the handlers); unversioned `/api/*`
  paths remain stable aliases. Policy documented in the OpenAPI info description and the developer portal: breaking changes ship as a new `/api/vN`
  with ≥6 months overlap, retirement signaled via `Deprecation`/`Sunset` headers.

- **pricing.md** — `/pricing.md` (content in `src/lib/agent/pricing.ts`, registered in `discovery-files.ts`). States the honest position: the
  interface is free with no accounts/subscriptions/tiers, the public MCP and REST surfaces need no key, and the aggregator API is by arrangement.
  Per-swap costs are documented as protocol-level fees (inbound gas, outbound, liquidity, any provider service/affiliate fee) itemised in each quote
  rather than charged by this site. Linked from llms.txt, AGENTS.md, the agent skill, the developer portal, agents.json, the home markdown response,
  and sitemap.xml.
- **Agent mode view** — `https://swap.thorchain.org/?mode=agent` returns a structured view instead of the client-rendered swap UI
  (`src/lib/agent/agent-mode.ts`, served from `src/proxy.ts` ahead of the markdown-variant branch). JSON when the request Accepts `application/json`,
  markdown otherwise; both carry capabilities (with per-capability access path and auth), an explicit not-supported list, the authentication model and
  scopes, MCP + REST endpoints, pricing summary, asset/amount/error conventions, safety rules, and discovery links. Capabilities and endpoints are
  derived from `MCP_TOOLS` and `developerEndpoints`, so they cannot drift from the MCP server and developer portal. `Vary: Accept` + `no-store`
  because the two representations share one URL.

- **Markdown URL fallback** — `/index.md` serves the homepage markdown, and appending `.md` to any content page URL now returns that page as markdown
  (`src/lib/agent/markdown-pages.ts`, resolved in `src/proxy.ts` after the static registry). Covers `/` → `/index.md`, `/developers` →
  `/developers.md`, and every swap-pair page → `/sell-btc-buy-eth.md` (generated; mirrors the `sell-<asset>-buy-<asset>` shape of
  `src/app/[pair]/page.tsx`, and paths that don't match still 404 like the HTML route). All bodies are `text/markdown` and start with an H1.
  `Accept: text/markdown` negotiation was generalised from `/` alone to every page that has a twin.
- **Agent skills** — expanded from one skill to four, one per capability area (`src/lib/agent/skills.ts`): `thorchain-swap` (navigation/safety),
  `thorchain-swap-quotes` (fetching and reading quotes), `thorchain-liquidity-pools` (depths, prices, halts), `thorchain-memoless-swap` (wallet-free
  flow, including the failure modes worth warning a user about). Each body now carries YAML frontmatter (name, description, version, license,
  homepage, tags) per the agentskills.io/skills.sh convention — the previous single SKILL.md had none. Routes and
  `/.well-known/agent-skills/index.json` are both generated from the `AGENT_SKILLS` array, so adding a skill needs no route wiring, and each index
  entry carries a sha256 digest of the served body.

## Gaps that need an off-repo action

- **SDK registry publication** — npm is already covered by [`@tcswap/sdk`](https://www.npmjs.com/package/@tcswap/sdk). The Python client still needs a
  release; Go needs none:

  ```
  cd sdk/python && python -m build && python -m twine upload dist/*
  # Go: `go get github.com/thorchain/swap.thorchain/sdk/go` works once the repo is pushed and tagged.
  ```

  Keep `project_urls.Homepage` / the module path pointing at swap.thorchain.org — that is how a scanner verifies the package is ours. `@tcswap/sdk`
  declares `homepage: https://github.com/thorchain/TCSwap`; naming the product domain in its npm metadata would help the same check, but that is a
  change for the TCSwap repo, not this one.

- **MCP Registry listing** — the server works but is not listed at `registry.modelcontextprotocol.io`, which is what most clients search.
  `server.json` and the `/.well-known/mcp-registry-auth` route are in the repo; publishing needs an Ed25519 key, the `MCP_REGISTRY_AUTH` env var
  deployed, and one `mcp-publisher publish` run. Full steps: `docs/agent-readiness/mcp-registry.md`.

## Gaps deliberately not addressed

- **Agent auth discovery metadata (3 pts)** — tried, shipped, reverted the same day. Publishing RFC 9728 `/.well-known/oauth-protected-resource` and
  RFC 8414 `/.well-known/oauth-authorization-server` (backed by real `/oauth/register` + `/oauth/token` endpoints for a client-credentials rate-limit
  tier) **broke MCP connector onboarding**. An MCP client treats the presence of protected-resource metadata as "this server requires OAuth": it
  fetches the AS metadata, then attempts RFC 7591 dynamic client registration with `grant_types: ["authorization_code"]` and `redirect_uris`, because
  a connector UI has nowhere to put a client secret. Our registration endpoint only spoke `client_credentials` and answered
  `400 invalid_client_metadata`, so the user saw _"Couldn't register with … sign-in service"_ and could not add the connector at all. Before the
  metadata existed, the probe 404'd, the client concluded the server was open, and it connected on the first try.

  Making it work would mean implementing the full authorization-code + PKCE flow — an `/oauth/authorize` endpoint that auto-approves an anonymous
  user, stateless redirect_uri validation signed into the client id, and refresh tokens — i.e. redirect handling on the domain people use to swap
  crypto, in exchange for 3 scanner points and a rate-limit tier nobody asked for. Not worth it for a read-only server that needs no credential.

  **Do not re-add any `/.well-known/oauth-*` document while the MCP server is anonymous.** `testNoAuthorizationSurfaceBlocksConnectors` in
  `test/agent-contracts.test.mjs` pins this: the well-known paths must 404, registration must not exist, a stray `Authorization` header must not
  produce a 401, and the server card must not advertise an optional auth flow. If the site ever gains real user accounts, revisit with the full
  authorization-code flow — not with metadata alone.

- **skills.sh listing** — the four skills above are the in-repo prerequisite, but the orank check looks for _published_ skills on skills.sh, which is
  an external registry. Someone with an account has to submit them (they live at `https://swap.thorchain.org/.well-known/agent-skills/index.json` and
  each `SKILL.md` URL). No further code change helps until that submission happens.
- **UCP (Universal Commerce Protocol)** — the Payments layer is scored 0/0 (warning only). A noncustodial swap interface has no checkout: publishing
  `/.well-known/ucp` and a `POST /checkout-sessions` surface would advertise a commerce capability the site does not have, and the server can neither
  hold funds nor execute swaps for users. Skip unless the scoring changes and a genuine payment product exists.

## Gaps that cannot be fixed (or only partially) in this repo

- **Developer resource discoverability** — the check runs a live web search for "thorchain developer resources". In-repo levers have been pulled: the
  /developers title, H1, meta description, and intro now carry the exact phrase "THORChain developer resources"; the page ships WebPage + WebAPI +
  BreadcrumbList JSON-LD; sitemap.xml has lastmod dates and a higher /developers priority; and an IndexNow key is published at
  `/c3f786d3e23043e84baedc667c7ddbed.txt` (key file in `public/`). After each deploy that changes these pages, ping IndexNow so Bing (which powers
  most AI-agent search) picks them up:

  ```
  curl 'https://api.indexnow.org/indexnow?url=https://swap.thorchain.org/developers&key=c3f786d3e23043e84baedc667c7ddbed'
  ```

  Beyond that, scoring depends on search indexing and ranking (time + off-site backlinks). Submitting the sitemap in Google Search Console and Bing
  Webmaster Tools would also help — off-repo, needs account access.

  Progress (August 20, 2026): the in-repo half was extended — six named topic pages under `/developers/<topic>` (each with "THORChain Swap" in the
  title, H1, and description), `TechArticle` JSON-LD, sitemap entries, `.md` twins, guessable aliases (`/docs`, `/api-docs`, `/sdk`, …), and links
  from llms.txt, AGENTS.md, agents.json, and the API catalog. Ping IndexNow for the new URLs after deploy:

  ```
  for p in developers developers/quickstart developers/api developers/mcp developers/auth developers/sdks developers/webhooks; do
    curl "https://api.indexnow.org/indexnow?url=https://swap.thorchain.org/$p&key=c3f786d3e23043e84baedc667c7ddbed"
  done
  ```

  Progress (July 15, 2026): IndexNow ping submitted (HTTP 202) for /, /developers, /llms.txt, /AGENTS.md after the SEO changes deployed. README.md
  rewritten from create-next-app boilerplate to a name-rich page with "THORChain Developer Resources" and agent-resources sections — GitHub READMEs
  index quickly for brand-name queries (needs push to github.com/thorchain/swap.thorchain to take effect). Remaining off-repo: a linked section on
  docs.thorchain.org (proposal text handed to the user for the docs maintainers), Search Console / Bing Webmaster sitemap submission, and indexing
  lag.

- **Wikipedia / Wikidata entity presence** — requires off-site editorial work, not code:
  1. Collect independent press coverage of THORChain to satisfy Wikipedia notability.
  2. Draft a neutral, well-cited Wikipedia article (avoid self-promotion; disclose any conflict of interest per Wikipedia policy).
  3. Create a Wikidata item for THORChain with property **P856 (official website) = https://swap.thorchain.org** and link it to the article.
- **ChatGPT app listed** — off-repo submission to the GPT Store / ChatGPT app directory, needs an OpenAI account and a published app listing. The MCP
  server at `/mcp` is the integration surface a listing would point at; nothing further is needed in this repo.
