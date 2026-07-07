import { createHash } from 'node:crypto'
import { AppConfig } from '@/config'

export const agentSkillMarkdown = `# THORChain Swap Agent Skill

Use this skill when an agent needs to understand or navigate the public THORChain Swap interface.

## What This Site Does

THORChain Swap is a public web interface for native cross-chain swaps powered by THORChain and Maya Protocol providers.

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
- ${AppConfig.baseUrl}/.well-known/api-catalog
- ${AppConfig.baseUrl}/.well-known/openapi.json
- ${AppConfig.baseUrl}/.well-known/mcp-server-card
- ${AppConfig.baseUrl}/auth.md
`

export const agentsMarkdown = `# AGENTS.md — THORChain Swap

Guidance for AI agents interacting with the public THORChain Swap web interface.

## What This Site Does

THORChain Swap (${AppConfig.baseUrl}) is a public web interface for native cross-chain swaps powered by THORChain and Maya Protocol.
There are no user accounts; users connect their own wallets in the browser and sign transactions locally.

## MCP Server

A public, unauthenticated, rate-limited MCP server (streamable HTTP, stateless, JSON responses) is available at:

- Endpoint: ${AppConfig.baseUrl}/mcp
- Server card: ${AppConfig.baseUrl}/.well-known/mcp-server-card

Tools (read-only):

- \`get_swap_quote\` — fetch a THORChain swap quote for an asset pair (amounts in 1e8 base units).
- \`list_pools\` — list liquidity pools with status, depths, and USD asset price.
- \`get_network_status\` — current THORChain network parameters.

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

- POST /api/newsletter — subscribe an email address to updates.
- POST /api/report-bug — submit a bug report or feature request.

Both are unauthenticated and rate limited per client (429 with Retry-After when exceeded).

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
`

export const llmsTxt = `# THORChain Swap

> THORChain Swap is the public web interface for native cross-chain swaps (BTC, ETH, and more) powered by THORChain and Maya Protocol. No accounts, no bridges, no wrapping; users sign transactions in their own wallets.

## Agent Resources

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
Wallet connection and transaction signing are performed by user-controlled wallets in the browser.

The public support APIs documented in the API catalog are unauthenticated at the HTTP layer and enforce per-client rate limits.
The public MCP server at ${AppConfig.baseUrl}/mcp is likewise unauthenticated and rate limited.
There is no public self-service OAuth credential issuance for agents at this time, and the OAuth endpoints below respond with errors until issuance is enabled.

## Discovery Metadata

- OAuth authorization server metadata: ${AppConfig.baseUrl}/.well-known/oauth-authorization-server
- OAuth protected resource metadata: ${AppConfig.baseUrl}/.well-known/oauth-protected-resource
- API catalog: ${AppConfig.baseUrl}/.well-known/api-catalog
- MCP server card: ${AppConfig.baseUrl}/.well-known/mcp-server-card

## Agent Registration

Self-service agent registration is not currently enabled.
Teams that need authenticated integration access should coordinate with the THORChain Swap maintainers.
`

function sha256Digest(value: string) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

export const agentSkillDigest = sha256Digest(agentSkillMarkdown)
