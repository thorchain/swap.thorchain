import { AppConfig } from '@/config'
import { DEVELOPER_DOCS } from '@/lib/agent/developer-docs'
import { SDK_PACKAGES } from '@/lib/agent/sdks'

export const agentsMarkdown = `# AGENTS.md — THORChain Swap

Guidance for AI agents interacting with the public THORChain Swap web interface.

## When To Use This Site

- A user wants to swap native L1 assets (BTC, ETH, stablecoins, …) without bridges, wrapped tokens, or accounts.
- A user needs a live cross-chain swap quote, pool depths, or THORChain network status — use the MCP server below (no API key).
- A user wants to swap without connecting a wallet — the memoless (instant) swap flow sends funds to a deposit address.

Not a fit for: fiat on/off-ramps, NFTs, derivatives, or custodial accounts.

## What This Site Does

THORChain Swap (${AppConfig.baseUrl}) is a public web interface for native cross-chain swaps powered by THORChain and Maya Protocol.
There are no user accounts. Users either connect their own wallet in the browser and sign transactions locally, or swap without connecting a wallet at all via memoless ("instant") swaps — sending funds directly to a deposit address.

## Architecture and Data Sources

The application consists of two components:

- **UI** — this site (${AppConfig.baseUrl}).
- **Backend API** — the THORChain/Maya Protocol swap aggregator, which the UI queries for swap quotes and routing:
  - https://api.thorchain.org/v1 — swap quotes and routes across THORChain and Maya Protocol providers. Requires an \`x-api-key\` header; keys are free and issued through the affiliate program at ${AppConfig.affiliateLink} after review (see ${AppConfig.baseUrl}/auth.md).
  - https://api.thorchain.org/memoless/api/v1 — memoless ("instant") swaps without a connected wallet. No API key required.

The UI additionally reads protocol metadata (pools, network parameters, balances, THORNames, inbound addresses) directly from public THORNode and Midgard APIs.

Agents without an aggregator key can use the memoless API or the public MCP server below, which serves quote, pool, and network data from THORNode with no authentication.

## Developer Portal

Full developer documentation lives at ${AppConfig.baseUrl}/developers (markdown: ${AppConfig.baseUrl}/developers.md), with one named page per topic:

${DEVELOPER_DOCS.map(doc => `- ${AppConfig.baseUrl}/developers/${doc.slug} — ${doc.navTitle} (markdown: ${AppConfig.baseUrl}/developers/${doc.slug}.md)`).join('\n')}

## MCP Server

A public, unauthenticated, rate-limited MCP server (streamable HTTP, stateless, JSON responses) is available at:

- Endpoint: ${AppConfig.baseUrl}/mcp (\`GET\` returns the server card; JSON-RPC over \`POST\`)
- Server card: ${AppConfig.baseUrl}/.well-known/mcp/server-card.json (aliases: /.well-known/mcp.json, /mcp.json)

Tools (read-only, each with a typed JSON Schema in \`tools/list\`):

- \`get_swap_quote\` — swap quote for an asset pair. Required: \`from_asset\`, \`to_asset\`, \`amount\` (1e8 base units). Optional: \`destination\`, \`streaming_interval\`.
- \`list_pools\` — liquidity pools with status, depths, and USD asset price. Optional: \`status\` (Available/Staged/Suspended), \`asset\`, \`limit\`.
- \`get_network_status\` — current THORChain network parameters. Optional: \`fields\` (array of top-level keys to return).

No credential is required or accepted; calls are rate limited to 60 requests per 10 minutes per client. See ${AppConfig.baseUrl}/auth.md.

The server supports MCP Apps (io.modelcontextprotocol/ui): \`get_swap_quote\` links a \`ui://thorchain-swap/swap-quote\` view via \`_meta.ui.resourceUri\`, so hosts that support MCP Apps can render quotes as an interactive panel. Hosts without MCP Apps support get plain JSON.

The server never holds keys, signs, or submits transactions.

## Public Pages

- Swap: ${AppConfig.baseUrl}/
- Pool: https://pool.thorchain.org/
- Bond: https://bond.thorchain.org/
- Memo: https://memo.thorchain.org/
- TCY: https://tcy.thorchain.org/
- THORName: https://thorname.thorchain.org/

## Public REST APIs

Documented in the OpenAPI description (${AppConfig.baseUrl}/.well-known/openapi.json) and API catalog (${AppConfig.baseUrl}/.well-known/api-catalog):

- POST /api/v1/newsletter — subscribe an email address to updates.
- POST /api/v1/report-bug — submit a bug report or feature request.

Both are unauthenticated and rate limited per client (429 with Retry-After when exceeded), and both accept an \`Idempotency-Key\` header so retries never duplicate a submission. The API is versioned in the URL path (/api/v1/); unversioned /api/* paths remain as stable aliases.
These are the site's own support endpoints; swap quotes are not served under ${AppConfig.baseUrl}/api — use the MCP server or the aggregator backend described above.

## SDKs

Official clients wrap the MCP tools and the REST endpoints:

${SDK_PACKAGES.map(pkg => `- ${pkg.language} — \`${pkg.name}\` (${pkg.ecosystem}): ${pkg.source}`).join('\n')}

Reference: ${AppConfig.baseUrl}/developers/sdks

## Safety Rules

- Never request, store, or infer private keys or seed phrases.
- Never execute swaps on behalf of a user; only users sign transactions in their own wallets.
- Treat quotes, balances, and transaction state as time-sensitive; re-fetch before presenting.
- A quote's memo and inbound address expire; never reuse them after expiry.
- Confirm destination addresses with the user before they submit any transaction.

## More Discovery

- ${AppConfig.baseUrl}/llms.txt
- ${AppConfig.baseUrl}/auth.md — the authentication model: none for this site, affiliate program for aggregator keys
- ${AppConfig.baseUrl}/.well-known/agent-skills/index.json — published skills: thorchain-swap, thorchain-swap-quotes, thorchain-liquidity-pools, thorchain-memoless-swap
- ${AppConfig.baseUrl}/.well-known/ai-catalog.json — ARD catalog of MCP, A2A, OpenAPI, API catalog, and Agent Skills resources
- ${AppConfig.baseUrl}/index.md — homepage as markdown; append \`.md\` to any content page URL for its markdown twin
- ${AppConfig.baseUrl}/about.md — product identity, architecture, and self-custody model
- ${AppConfig.baseUrl}/contact.md — official support channels and security warning
- ${AppConfig.baseUrl}/.well-known/agent-card.json
- ${AppConfig.baseUrl}/pricing.md — pricing and per-swap fee model
- ${AppConfig.baseUrl}/?mode=agent — structured agent view of the homepage (JSON with \`Accept: application/json\`)
- Source code (with AGENTS.md for coding agents): https://github.com/thorchain/swap.thorchain
`

export const llmsTxt = `# THORChain Swap

> THORChain Swap is the public web interface for native cross-chain swaps (BTC, ETH, and more) powered by THORChain and Maya Protocol. No accounts, no bridges, no wrapping; users sign transactions in their own wallets, or swap without connecting a wallet via memoless (instant) swaps.

## Architecture

- UI: this site (${AppConfig.baseUrl})
- Backend API: the THORChain/Maya swap aggregator — quotes and routing at https://api.thorchain.org/v1 (\`x-api-key\` gated; free keys via the affiliate program at ${AppConfig.affiliateLink}), memoless (instant) swaps at https://api.thorchain.org/memoless/api/v1 (no key required)
- Protocol metadata (pools, network, names, balances): public THORNode and Midgard APIs
- Keyless agent access to quotes, pools, and network data: MCP server at ${AppConfig.baseUrl}/mcp

## When To Use THORChain Swap

Reach for this site (or its MCP server) when a user wants to:

- Swap native layer-1 assets — BTC, ETH, stablecoins, and other supported chain assets — without bridges, wrapped tokens, or custodial accounts.
- Get a live cross-chain swap quote (expected output, fees, slippage, memo, inbound address): call the \`get_swap_quote\` MCP tool at ${AppConfig.baseUrl}/mcp, no API key needed.
- Check THORChain liquidity pool depths or network status: \`list_pools\` and \`get_network_status\` MCP tools.
- Swap without connecting a wallet: direct the user to the memoless (instant) swap flow at ${AppConfig.baseUrl}/, where they send funds to a deposit address.
- Register or look up THORNames, bond to nodes, or manage liquidity positions: use the dedicated interfaces listed below.

Do not use this site for fiat on/off-ramps, NFTs, derivatives, or custodial account management — it does none of those. Never attempt to execute a swap on a user's behalf; users sign in their own wallets (or send funds themselves via memoless swaps).

## Developer Resources

- [Developer portal](${AppConfig.baseUrl}/developers): THORChain Swap API docs, quickstart, MCP server, auth scopes, and sandbox
- [Developer portal (markdown)](${AppConfig.baseUrl}/developers.md): the same documentation as markdown
${DEVELOPER_DOCS.map(doc => `- [THORChain Swap ${doc.navTitle}](${AppConfig.baseUrl}/developers/${doc.slug}): ${doc.description}`).join('\n')}
- [SDK packages](${AppConfig.baseUrl}/developers/sdks): ${SDK_PACKAGES.map(pkg => `${pkg.language} (\`${pkg.name}\`)`).join(', ')}
- [Affiliate program](${AppConfig.affiliateLink}): free \`x-api-key\` for the swap aggregator API (quotes and routing), affiliate/service fee splits, the embeddable widget, and earnings reporting — register, verify your email, key issued on approval
- [Pricing](${AppConfig.baseUrl}/pricing.md): what THORChain Swap costs to use (free) and how per-swap protocol fees work
- [About](${AppConfig.baseUrl}/about): product identity, architecture, and self-custody model
- [Contact](${AppConfig.baseUrl}/contact): official support channels and security guidance
- [Source code](https://github.com/thorchain/swap.thorchain): public repository, with AGENTS.md instructions for AI coding agents

## Agent Resources

- [Agent library (full)](${AppConfig.baseUrl}/llms-full.md): the complete single-file reference — URL scheme, MCP examples, asset notation, quote semantics, REST endpoints, and safety rules (also at [/llms-full.txt](${AppConfig.baseUrl}/llms-full.txt))
- [AGENTS.md](${AppConfig.baseUrl}/AGENTS.md): guidance for AI agents using this site
- [MCP server card](${AppConfig.baseUrl}/.well-known/mcp/server-card.json): public MCP server with swap-quote, pool, and network tools
- [OpenAPI description](${AppConfig.baseUrl}/.well-known/openapi.json): public REST endpoints
- [API catalog](${AppConfig.baseUrl}/.well-known/api-catalog): RFC 9727 linkset of public APIs
- [ARD AI catalog](${AppConfig.baseUrl}/.well-known/ai-catalog.json): consolidated discovery of MCP, A2A, OpenAPI, API catalog, and Agent Skills resources
- [Agent skills index](${AppConfig.baseUrl}/.well-known/agent-skills/index.json): published agent skills
- [auth.md](${AppConfig.baseUrl}/auth.md): authentication model for agents — none needed for this site's surfaces
- [Markdown twins](${AppConfig.baseUrl}/index.md): append \`.md\` to any content page URL for a markdown version (\`/index.md\`, \`/about.md\`, \`/contact.md\`, \`/developers.md\`, \`/sell-btc-buy-eth.md\`), or send \`Accept: text/markdown\`
- [Agent skills index](${AppConfig.baseUrl}/.well-known/agent-skills/index.json): four published skills — navigation, quotes, pools, and memoless swaps
- [Agent view](${AppConfig.baseUrl}/?mode=agent): the homepage as structured data — capabilities, endpoints, auth, and pricing (JSON with \`Accept: application/json\`, markdown otherwise)

## Interfaces

- [Swap](${AppConfig.baseUrl}/): main cross-chain swap interface
- [Pool](https://pool.thorchain.org/): liquidity pools
- [Bond](https://bond.thorchain.org/): node bonding
- [Memo](https://memo.thorchain.org/): raw memo transactions
- [TCY](https://tcy.thorchain.org/): TCY interface
- [THORName](https://thorname.thorchain.org/): THORName registration
`

export const authMarkdown = `# auth.md — THORChain Swap

How agents authenticate against THORChain Swap (${AppConfig.baseUrl}): anonymously, always. This site issues no credential of any kind and accepts none; calls are rate limited per client.

## Audience

Agents and developers using the public THORChain Swap web interface, its public MCP server, and its public support APIs.

## Current Authentication Model

The public web interface requires no account authentication for browsing. Wallet connection and transaction signing are performed by user-controlled wallets in the browser; memoless ("instant") swaps work without connecting a wallet.

The public MCP server at ${AppConfig.baseUrl}/mcp and the public support APIs are anonymous and rate limited per client. No credential issued by this site can move funds, sign a transaction, or read anything that is not already public.

The swap aggregator backend that powers the UI (https://api.thorchain.org/v1) is separate: it requires an \`x-api-key\` header. Keys are free and issued through the affiliate program — register at ${AppConfig.affiliateLink} with your name, email, website, and Telegram, verify the email, and the key is issued once the account is approved. The same account sets affiliate/service fee splits, embeds the swap widget, and tracks earnings. The memoless API (https://api.thorchain.org/memoless/api/v1) requires no API key.

## Which Credential Do I Need?

Two different things, often confused:

| Want to | Need | How |
| --- | --- | --- |
| Read quotes, pools, network state | Nothing at all | Call ${AppConfig.baseUrl}/mcp directly |
| Build a swap flow on the aggregator, earn affiliate fees, embed the widget | An \`x-api-key\` for https://api.thorchain.org/v1 | Apply at ${AppConfig.affiliateLink} (free, reviewed) |

## No Authorization Server

This site runs no authorization server and issues no tokens. There is deliberately **no** \`/.well-known/oauth-protected-resource\` and **no** \`/.well-known/oauth-authorization-server\`: an MCP client that probes for them finds nothing, concludes the server is open, and connects. Publishing that metadata for a server that needs no credential only makes connectors attempt a sign-in flow that has nothing to sign in to.

Add the MCP server to any client with the URL alone:

\`\`\`bash
claude mcp add --transport http thorchain-swap ${AppConfig.baseUrl}/mcp
\`\`\`

If a client asks for an OAuth client ID, API key, or bearer token for ${AppConfig.baseUrl}/mcp, leave it blank — none exists.

## Partner API Keys

The swap aggregator behind the UI (https://api.thorchain.org/v1) is a separate system and does take an \`x-api-key\`. Keys are free through the affiliate program: register at ${AppConfig.affiliateLink} with your name, email, website, and Telegram, verify the email, and the key is issued once the account is approved. That account also sets affiliate/service fee splits, generates the embeddable widget, and reports earnings. Nothing on this site issues or replaces that key.

## Discovery Metadata

- API catalog: ${AppConfig.baseUrl}/.well-known/api-catalog
- MCP server card: ${AppConfig.baseUrl}/.well-known/mcp/server-card.json

## More

Full documentation: ${AppConfig.baseUrl}/developers/auth (markdown: ${AppConfig.baseUrl}/developers/auth.md). Developer portal: ${AppConfig.baseUrl}/developers (markdown: ${AppConfig.baseUrl}/developers.md).
`

// Complete single-file agent reference (llmstxt.org convention), served at
// /llms-full.md and /llms-full.txt.
export const llmsFullMarkdown = `# THORChain Swap — Agent Library

The complete reference for AI agents using THORChain Swap (${AppConfig.baseUrl}), the public web interface for native cross-chain swaps powered by THORChain and Maya Protocol. Everything here is public; nothing requires authentication.

## What This Site Does

THORChain Swap swaps native layer-1 assets (BTC, ETH, stablecoins, and more) directly between chains — no bridges, no wrapped tokens, no order books, and no user accounts. Swaps settle in native assets on their own chains. Users either connect their own wallet and sign locally, or swap without connecting a wallet at all via memoless ("instant") swaps: they send funds to a deposit address and receive the swapped asset at their destination address.

## When To Use

- A user wants to swap native L1 assets without bridges, wrapped tokens, or custodial accounts.
- A user needs a live cross-chain swap quote, pool depths, or THORChain network status (use the MCP server; no API key).
- A user wants to swap without connecting a wallet (memoless flow).

Not a fit for: fiat on/off-ramps, NFTs, derivatives, or custodial account management. Never attempt to execute a swap on a user's behalf; users sign in their own wallets or send funds themselves.

## Architecture and Data Sources

Two components:

- **UI** — ${AppConfig.baseUrl}
- **Backend API** — the THORChain/Maya swap aggregator: https://api.thorchain.org/v1 for quotes and routing (requires an \`x-api-key\` header — free, via the affiliate program at ${AppConfig.affiliateLink}, issued after review) and https://api.thorchain.org/memoless/api/v1 for memoless swaps (no key).

Protocol metadata (pools, network parameters, THORNames, balances, inbound addresses) comes from public THORNode and Midgard APIs. Keyless agent access to quotes, pools, and network data: the MCP server below.

## Deep Links (URL Scheme)

Hand users a prefilled swap URL:

\`\`\`
${AppConfig.baseUrl}/sell-BTC-buy-ETH
${AppConfig.baseUrl}/sell-BTC.BTC-buy-ETH.USDC
\`\`\`

The path pattern is \`/sell-<asset>-buy-<asset>\`. Native gas assets may use just the ticker; tokens use \`CHAIN.TICKER\` (the full identifier with the contract-address suffix is also accepted).

## Asset Notation and Amounts

- Assets use \`CHAIN.SYMBOL\` notation: \`BTC.BTC\`, \`ETH.ETH\`, \`ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48\` (token contract appended after a hyphen, uppercase).
- Amounts across THORChain APIs are strings in 1e8 base units regardless of the asset's native decimals: \`"100000000"\` = 1 BTC = 1 ETH = 1 RUNE.

## Quote Semantics

- Quotes are indicative and time-sensitive; re-fetch before presenting.
- A quote with a \`destination\` address includes a usable \`memo\` and \`inbound_address\`. Both expire at \`expiry\` (unix seconds) — never reuse them after expiry.
- \`expected_amount_out\` is the estimate after fees; \`fees\` itemizes them; \`slippage_bps\` is the price impact.
- \`recommended_min_amount_in\` is the smallest economically sensible input; below it, fees dominate.
- Streaming swaps (\`streaming_interval\` blocks between sub-swaps) trade speed for better pricing on large amounts.

## MCP Server

Public, unauthenticated, rate-limited MCP server (streamable HTTP, stateless, JSON responses, POST only):

- Endpoint: ${AppConfig.baseUrl}/mcp
- Server card: ${AppConfig.baseUrl}/.well-known/mcp/server-card.json

Read-only tools, each with a typed JSON Schema returned by \`tools/list\`:

- \`get_swap_quote\` — swap quote for an asset pair. Required \`from_asset\`, \`to_asset\`, \`amount\` (1e8 base units); optional \`destination\`, \`streaming_interval\`
- \`list_pools\` — liquidity pools with status, depths, and USD asset price. Optional \`status\` (Available/Staged/Suspended), \`asset\`, \`limit\`
- \`get_network_status\` — current THORChain network parameters. Optional \`fields\` (array of top-level keys to project)

Example:

\`\`\`bash
curl -s ${AppConfig.baseUrl}/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_swap_quote","arguments":{"from_asset":"BTC.BTC","to_asset":"ETH.ETH","amount":"100000000"}}}'
\`\`\`

The server supports MCP Apps (io.modelcontextprotocol/ui): \`get_swap_quote\` links the \`ui://thorchain-swap/swap-quote\` view via \`_meta.ui.resourceUri\`; hosts without MCP Apps get plain JSON. The server never holds keys, signs, or submits transactions.

## REST API

Described by OpenAPI 3.1 at ${AppConfig.baseUrl}/.well-known/openapi.json. Versioned in the URL path; \`/api/v1/\` is canonical and unversioned \`/api/*\` paths are stable aliases.

- \`POST /api/v1/newsletter\` — subscribe an email address to updates
- \`POST /api/v1/report-bug\` — submit a bug report or feature request

Both are unauthenticated, rate limited per client (429 with Retry-After), and accept an \`Idempotency-Key\` header: a retry with the same key within one hour replays the original response (\`Idempotency-Replayed: true\`) instead of re-executing. Every non-2xx response is JSON with \`error\`, \`code\`, \`hint\`, and \`documentation\` fields. Swap quotes are NOT served under ${AppConfig.baseUrl}/api — use the MCP server or the aggregator backend.

## Authentication

Browsing, quoting, and the support APIs are anonymous. Wallet connection and signing happen in user-controlled wallets in the browser; memoless swaps need no wallet.

This site runs no authorization server and issues no tokens, so there is no \`/.well-known/oauth-protected-resource\` or \`/.well-known/oauth-authorization-server\` to discover — an MCP client that probes for them finds nothing and connects directly. The aggregator API (https://api.thorchain.org/v1) is separate and takes an \`x-api-key\` issued free through the affiliate program at ${AppConfig.affiliateLink}. Details: ${AppConfig.baseUrl}/auth.md.

## SDKs

${SDK_PACKAGES.map(pkg => `- ${pkg.language} — \`${pkg.name}\` (${pkg.ecosystem}): ${pkg.source}`).join('\n')}

Reference: ${AppConfig.baseUrl}/developers/sdks

## Discovery Endpoints

- ${AppConfig.baseUrl}/llms.txt — index of agent resources
- ${AppConfig.baseUrl}/AGENTS.md — agent guidance and safety rules
- ${AppConfig.baseUrl}/developers — developer portal (markdown: /developers.md)
${DEVELOPER_DOCS.map(doc => `- ${AppConfig.baseUrl}/developers/${doc.slug} — ${doc.navTitle}`).join('\n')}
- ${AppConfig.baseUrl}/.well-known/openapi.json — OpenAPI 3.1 description
- ${AppConfig.baseUrl}/.well-known/api-catalog — RFC 9727 API catalog
- ${AppConfig.baseUrl}/.well-known/mcp/server-card.json — MCP server card
- ${AppConfig.baseUrl}/.well-known/agent-card.json — A2A agent card
- ${AppConfig.baseUrl}/.well-known/agent-skills/index.json — agent skills index
- ${AppConfig.baseUrl}/auth.md — authentication model
- Source code (with AGENTS.md for coding agents): https://github.com/thorchain/swap.thorchain

## Other Interfaces

- Pool: https://pool.thorchain.org/
- Bond: https://bond.thorchain.org/
- Memo: https://memo.thorchain.org/
- TCY: https://tcy.thorchain.org/
- THORName: https://thorname.thorchain.org/

## Safety Rules

1. Never request, store, or infer private keys or seed phrases.
2. Never execute swaps on behalf of a user — only users sign transactions in their own wallets.
3. Treat quotes, balances, and transaction state as time-sensitive; re-fetch before presenting.
4. Never reuse a quote's \`memo\` or \`inbound_address\` after its \`expiry\`.
5. Confirm destination addresses with the user before they submit any transaction.

## Support

- Email: ${AppConfig.supportEmail}
- Bug reports: \`POST /api/v1/report-bug\`
`
