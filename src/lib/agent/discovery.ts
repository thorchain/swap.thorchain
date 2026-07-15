import { createHash } from 'node:crypto'
import { AppConfig } from '@/config'

export const agentSkillMarkdown = `# THORChain Swap Agent Skill

Use this skill when an agent needs to understand or navigate the public THORChain Swap interface.

## What This Site Does

THORChain Swap is a public web interface for native cross-chain swaps powered by THORChain and Maya Protocol providers.
The UI is backed by the THORChain/Maya swap aggregator API (https://api.thorchain.org/v1 for quotes and routing, API-key gated; https://api.thorchain.org/memoless/api/v1 for memoless "instant" swaps, no key) and reads protocol metadata from public THORNode and Midgard APIs.
Users sign transactions in their own wallets, or swap without connecting a wallet via memoless swaps.

## Safe Public Actions

- Read public discovery documents.
- Open the swap interface.
- Open the pool, bond, memo, TCY, and THORName public interfaces.
- Fetch quotes, pools, and network data through the public MCP server at ${AppConfig.baseUrl}/mcp.
- Submit feedback only through the documented public API.

## Safety Rules

- Do not request, store, or infer private keys or seed phrases.
- Do not execute swaps for a user.
- Do not connect wallets without explicit user action in the browser.
- Treat quotes, balances, and transaction state as time-sensitive.
- Confirm destination addresses before any user submits a transaction.

## Discovery URLs

- ${AppConfig.baseUrl}/robots.txt
- ${AppConfig.baseUrl}/sitemap.xml
- ${AppConfig.baseUrl}/llms.txt
- ${AppConfig.baseUrl}/AGENTS.md
- ${AppConfig.baseUrl}/developers.md
- ${AppConfig.baseUrl}/.well-known/api-catalog
- ${AppConfig.baseUrl}/.well-known/openapi.json
- ${AppConfig.baseUrl}/.well-known/mcp-server-card
- ${AppConfig.baseUrl}/auth.md
`

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
  - https://api.thorchain.org/v1 — swap quotes and routes across THORChain and Maya Protocol providers. Requires an \`x-api-key\` header; keys are not self-service (see ${AppConfig.baseUrl}/auth.md).
  - https://api.thorchain.org/memoless/api/v1 — memoless ("instant") swaps without a connected wallet. No API key required.

The UI additionally reads protocol metadata (pools, network parameters, balances, THORNames, inbound addresses) directly from public THORNode and Midgard APIs.

Agents without an aggregator key can use the memoless API or the public MCP server below, which serves quote, pool, and network data from THORNode with no authentication.

## Developer Portal

Full developer documentation (quickstart, API reference, MCP server, auth scopes, error format, sandbox) lives at:

- HTML: ${AppConfig.baseUrl}/developers
- Markdown: ${AppConfig.baseUrl}/developers.md

## MCP Server

A public, unauthenticated, rate-limited MCP server (streamable HTTP, stateless, JSON responses) is available at:

- Endpoint: ${AppConfig.baseUrl}/mcp
- Server card: ${AppConfig.baseUrl}/.well-known/mcp-server-card

Tools (read-only):

- \`get_swap_quote\` — fetch a THORChain swap quote for an asset pair (amounts in 1e8 base units).
- \`list_pools\` — list liquidity pools with status, depths, and USD asset price.
- \`get_network_status\` — current THORChain network parameters.

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

## Safety Rules

- Never request, store, or infer private keys or seed phrases.
- Never execute swaps on behalf of a user; only users sign transactions in their own wallets.
- Treat quotes, balances, and transaction state as time-sensitive; re-fetch before presenting.
- A quote's memo and inbound address expire; never reuse them after expiry.
- Confirm destination addresses with the user before they submit any transaction.

## More Discovery

- ${AppConfig.baseUrl}/llms.txt
- ${AppConfig.baseUrl}/auth.md
- ${AppConfig.baseUrl}/.well-known/agent-skills/index.json
- ${AppConfig.baseUrl}/.well-known/agent-card.json
- Source code (with AGENTS.md for coding agents): https://github.com/thorchain/swap.thorchain
`

export const llmsTxt = `# THORChain Swap

> THORChain Swap is the public web interface for native cross-chain swaps (BTC, ETH, and more) powered by THORChain and Maya Protocol. No accounts, no bridges, no wrapping; users sign transactions in their own wallets, or swap without connecting a wallet via memoless (instant) swaps.

## Architecture

- UI: this site (${AppConfig.baseUrl})
- Backend API: the THORChain/Maya swap aggregator — quotes and routing at https://api.thorchain.org/v1 (API-key gated), memoless (instant) swaps at https://api.thorchain.org/memoless/api/v1 (no key required)
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
- [Source code](https://github.com/thorchain/swap.thorchain): public repository, with AGENTS.md instructions for AI coding agents

## Agent Resources

- [Agent library (full)](${AppConfig.baseUrl}/llms-full.md): the complete single-file reference — URL scheme, MCP examples, asset notation, quote semantics, REST endpoints, and safety rules (also at [/llms-full.txt](${AppConfig.baseUrl}/llms-full.txt))
- [AGENTS.md](${AppConfig.baseUrl}/AGENTS.md): guidance for AI agents using this site
- [MCP server card](${AppConfig.baseUrl}/.well-known/mcp-server-card): public MCP server with swap-quote, pool, and network tools
- [OpenAPI description](${AppConfig.baseUrl}/.well-known/openapi.json): public REST endpoints
- [API catalog](${AppConfig.baseUrl}/.well-known/api-catalog): RFC 9727 linkset of public APIs
- [Agent skills index](${AppConfig.baseUrl}/.well-known/agent-skills/index.json): published agent skills
- [auth.md](${AppConfig.baseUrl}/auth.md): authentication model for agents

## Interfaces

- [Swap](${AppConfig.baseUrl}/): main cross-chain swap interface
- [Pool](https://pool.thorchain.org/): liquidity pools
- [Bond](https://bond.thorchain.org/): node bonding
- [Memo](https://memo.thorchain.org/): raw memo transactions
- [TCY](https://tcy.thorchain.org/): TCY interface
- [THORName](https://thorname.thorchain.org/): THORName registration
`

export const authMarkdown = `# auth.md

THORChain Swap publishes public discovery metadata for agents.

## Audience

This document is for agents and developers inspecting the public THORChain Swap web interface and its public support APIs.

## Current Authentication Model

The public web interface does not require account authentication for browsing.
Wallet connection and transaction signing are performed by user-controlled wallets in the browser; memoless ("instant") swaps work without connecting a wallet.

The swap aggregator backend that powers the UI (https://api.thorchain.org/v1) requires an \`x-api-key\` header; keys are not self-service — coordinate with the THORChain Swap maintainers.
The memoless API (https://api.thorchain.org/memoless/api/v1) requires no API key.
Keyless access to quotes, pools, and network data is also available through the MCP server at ${AppConfig.baseUrl}/mcp.

The public support APIs documented in the API catalog are unauthenticated at the HTTP layer and enforce per-client rate limits.
The public MCP server at ${AppConfig.baseUrl}/mcp is likewise unauthenticated and rate limited.
There is no public self-service OAuth credential issuance for agents at this time, and the OAuth endpoints below respond with errors until issuance is enabled.

## Scopes

The OpenAPI description (${AppConfig.baseUrl}/.well-known/openapi.json) declares an OAuth 2.0 security scheme with least-privilege scopes, matching the authorization server metadata:

- \`read:public\` — read public discovery documents, quotes, pools, and network data.
- \`submit:feedback\` — submit newsletter subscriptions and bug reports.

Anonymous access is currently permitted for everything these scopes cover; agents should still request only the scopes they need once issuance is enabled.

## Discovery Metadata

- OAuth authorization server metadata: ${AppConfig.baseUrl}/.well-known/oauth-authorization-server
- OAuth protected resource metadata: ${AppConfig.baseUrl}/.well-known/oauth-protected-resource
- API catalog: ${AppConfig.baseUrl}/.well-known/api-catalog
- MCP server card: ${AppConfig.baseUrl}/.well-known/mcp-server-card

## Agent Registration

Self-service agent registration is not currently enabled.
Teams that need authenticated integration access should coordinate with the THORChain Swap maintainers.

## More

Full developer documentation lives at ${AppConfig.baseUrl}/developers (markdown: ${AppConfig.baseUrl}/developers.md).
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
- **Backend API** — the THORChain/Maya swap aggregator: https://api.thorchain.org/v1 for quotes and routing (requires an \`x-api-key\` header; keys are not self-service) and https://api.thorchain.org/memoless/api/v1 for memoless swaps (no key).

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
- Server card: ${AppConfig.baseUrl}/.well-known/mcp-server-card

Read-only tools:

- \`get_swap_quote\` — swap quote for an asset pair (1e8 base units; optional \`destination\`, \`streaming_interval\`)
- \`list_pools\` — liquidity pools with status, depths, and USD asset price
- \`get_network_status\` — current THORChain network parameters

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

Browsing, quoting, and the support APIs are anonymous. Wallet connection and signing happen in user-controlled wallets in the browser; memoless swaps need no wallet. OAuth scopes (\`read:public\`, \`submit:feedback\`) are declared for future self-service issuance — see ${AppConfig.baseUrl}/auth.md.

## Discovery Endpoints

- ${AppConfig.baseUrl}/llms.txt — index of agent resources
- ${AppConfig.baseUrl}/AGENTS.md — agent guidance and safety rules
- ${AppConfig.baseUrl}/developers — developer portal (markdown: /developers.md)
- ${AppConfig.baseUrl}/.well-known/openapi.json — OpenAPI 3.1 description
- ${AppConfig.baseUrl}/.well-known/api-catalog — RFC 9727 API catalog
- ${AppConfig.baseUrl}/.well-known/mcp-server-card — MCP server card
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

function sha256Digest(value: string) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

export const agentSkillDigest = sha256Digest(agentSkillMarkdown)
