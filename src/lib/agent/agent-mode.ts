import { AppConfig } from '@/config'
import { developerEndpoints } from '@/lib/agent/developer-portal'
import { DEVELOPER_TOPICS } from '@/lib/agent/developer-topics'
import { CORE_MCP, CORE_MCP_TOOLS } from '@/lib/agent/core-mcp'
import { pricingPlans } from '@/lib/agent/pricing'

// The ?mode=agent view of the homepage: capabilities, endpoints, auth, and
// pricing as data instead of the client-rendered swap UI. Served by
// src/proxy.ts — JSON when the client accepts it, markdown otherwise.

const capabilities = [
  {
    id: 'swap-quote',
    summary: 'Fetch indicative swap output, fees, slippage, and timing; use core prepare_swap for executable deposit instructions.',
    access: `MCP tool quote_swap at ${CORE_MCP.endpoint}; amount is an integer in 1e8 base units`,
    authentication: 'none'
  },
  {
    id: 'list-pools',
    summary: 'List THORChain liquidity pools through Midgard with limit/offset pagination.',
    access: `MCP tool list_pools at ${CORE_MCP.endpoint}`,
    authentication: 'none'
  },
  {
    id: 'network-status',
    summary: 'Read node counts, APY, reserve, pooled RUNE, churn height, and vault migration state.',
    access: `MCP tool get_network_summary at ${CORE_MCP.endpoint}`,
    authentication: 'none'
  },
  {
    id: 'memoless-swap',
    summary: 'Swap without a connected wallet by sending funds to a deposit address; the user sends the funds themselves.',
    access: `${AppConfig.baseUrl}/ (UI) or https://api.thorchain.org/memoless/api/v1`,
    authentication: 'none'
  },
  {
    id: 'wallet-swap',
    summary: 'Swap by connecting a wallet in the browser; transactions are signed locally by the user.',
    access: `${AppConfig.baseUrl}/ (UI only — cannot be driven by an agent)`,
    authentication: 'user wallet'
  },
  {
    id: 'partner-api-key',
    summary: 'Obtain an aggregator API key (and affiliate fee splits, widget, and earnings reporting) through the affiliate program.',
    access: `${AppConfig.affiliateLink} — register, verify email, key issued on approval`,
    authentication: 'partner account'
  },
  {
    id: 'subscribe-updates',
    summary: 'Subscribe to updates through the public REST API.',
    access: `POST ${AppConfig.baseUrl}/api/v1/newsletter`,
    authentication: 'none (rate limited, Idempotency-Key supported)'
  }
]

const notSupported = [
  'Executing or signing a swap on a user behalf — the server holds no keys and never submits transactions.',
  'Fiat on/off-ramps, NFTs, derivatives, or custodial accounts.',
  'Any credential from this site — it issues none, and needs none.',
  'Instant, unreviewed keys for the swap aggregator backend (https://api.thorchain.org/v1) — those come from the affiliate program after review.'
]

const agentModeValue = {
  mode: 'agent',
  name: 'THORChain Swap',
  description:
    'Public web interface for native cross-chain swaps (BTC, ETH, stablecoins, and more) powered by THORChain and Maya Protocol. No accounts, no bridges, no wrapped assets.',
  url: AppConfig.baseUrl,
  capabilities,
  not_supported: notSupported,
  authentication: {
    model: 'anonymous',
    summary: `Browsing, quoting, the MCP server, and the support APIs require no credentials, and this site runs no authorization server — clients that probe for OAuth metadata find none and connect directly. The swap aggregator backend (https://api.thorchain.org/v1) takes an x-api-key issued free through the affiliate program at ${AppConfig.affiliateLink} after review; the memoless API and the MCP server need no key.`,
    documentation: `${AppConfig.baseUrl}/auth.md`
  },
  endpoints: {
    mcp: {
      url: CORE_MCP.endpoint,
      transport: 'streamable-http',
      serverInfo: { name: CORE_MCP.name, title: CORE_MCP.title },
      registry: { name: CORE_MCP.registryName, url: CORE_MCP.registryUrl },
      serverCard: `${AppConfig.baseUrl}/.well-known/mcp/server-card.json`,
      authentication: 'none',
      toolsScope: 'Selected examples; tools/list at the canonical endpoint is authoritative.',
      tools: CORE_MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    },
    rest: developerEndpoints.map(({ method, path, authentication, summary }) => ({
      method,
      url: `${AppConfig.baseUrl}${path}`,
      authentication,
      summary
    })),
    openapi: `${AppConfig.baseUrl}/openapi.json`,
    upstream: {
      aggregator: 'https://api.thorchain.org/v1',
      aggregatorKeys: AppConfig.affiliateLink,
      memoless: 'https://api.thorchain.org/memoless/api/v1'
    }
  },
  pricing: {
    summary: 'Free. No accounts, subscriptions, or usage tiers; per-swap costs are protocol fees itemised in each quote.',
    plans: pricingPlans,
    documentation: `${AppConfig.baseUrl}/pricing.md`
  },
  conventions: {
    asset_notation: 'CHAIN.SYMBOL, e.g. BTC.BTC, ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
    amounts: 'Core MCP quote_swap takes an integer in 1e8 base units (1 BTC = 100000000); REST protocol amounts are strings.',
    errors: 'Support REST APIs return JSON error, code, hint, and documentation fields. Core MCP uses JSON-RPC envelopes over JSON/SSE.',
    rate_limits: 'Support REST APIs return 429 with Retry-After. MCP limits belong to the canonical core deployment.'
  },
  safety: [
    'Never request, store, or infer private keys or seed phrases.',
    'Never execute a swap for a user; only users sign in their own wallets.',
    'Treat quotes, memos, inbound addresses, and balances as time-sensitive — re-fetch before presenting.',
    'Confirm destination addresses with the user before they submit any transaction.'
  ],
  discovery: {
    llms: `${AppConfig.baseUrl}/llms.txt`,
    llms_full: `${AppConfig.baseUrl}/llms-full.md`,
    agents: `${AppConfig.baseUrl}/AGENTS.md`,
    developers: `${AppConfig.baseUrl}/developers.md`,
    pricing: `${AppConfig.baseUrl}/pricing.md`,
    auth: `${AppConfig.baseUrl}/auth.md`,
    api_catalog: `${AppConfig.baseUrl}/.well-known/api-catalog`,
    agent_card: `${AppConfig.baseUrl}/.well-known/agent-card.json`,
    agent_skills: `${AppConfig.baseUrl}/.well-known/agent-skills/index.json`,
    developer_docs: DEVELOPER_TOPICS.map(topic => `${AppConfig.baseUrl}/developers/${topic.slug}`).join(', '),
    source: 'https://github.com/thorchain/swap.thorchain'
  }
}

export const agentModeJson = JSON.stringify(agentModeValue, null, 2)

export const agentModeMarkdown = `# THORChain Swap — Agent View

${agentModeValue.description}

This is the machine-readable view of ${AppConfig.baseUrl}/ (\`?mode=agent\`). The same document is available as JSON: request \`${AppConfig.baseUrl}/?mode=agent\` with \`Accept: application/json\`.

## Capabilities

${capabilities.map(c => `- **${c.id}** — ${c.summary}\n  - Access: ${c.access}\n  - Auth: ${c.authentication}`).join('\n')}

Not supported:

${notSupported.map(item => `- ${item}`).join('\n')}

## Authentication

${agentModeValue.authentication.summary}

No authorization server, no tokens: a client that probes for OAuth metadata finds none and connects directly. Aggregator API keys come from ${AppConfig.affiliateLink}.

Details: ${AppConfig.baseUrl}/auth.md and ${AppConfig.baseUrl}/developers/auth

## Endpoints

MCP server (streamable HTTP, no key) — ${CORE_MCP.endpoint}

Canonical Registry: ${CORE_MCP.registryName} (${CORE_MCP.registryUrl}). Send Accept: application/json, text/event-stream and support SSE responses. The legacy ${AppConfig.baseUrl}/mcp URL redirects with HTTP 308; it does not translate old tool names or arguments. The core endpoint currently has no browser CORS support; connect from an MCP host or a server-side client.

Selected tools (retrieve the full list with tools/list):

${CORE_MCP_TOOLS.map(tool => `- \`${tool.name}\` — ${tool.description}`).join('\n')}

REST:

${developerEndpoints.map(e => `- \`${e.method} ${AppConfig.baseUrl}${e.path}\` — ${e.summary} (auth: \`${e.authentication}\`)`).join('\n')}

OpenAPI description: ${AppConfig.baseUrl}/openapi.json

Upstream swap APIs the UI itself uses: https://api.thorchain.org/v1 (quotes and routing, \`x-api-key\` gated — free keys via ${AppConfig.affiliateLink}) and https://api.thorchain.org/memoless/api/v1 (memoless swaps, no key).

## Pricing

${agentModeValue.pricing.summary} Full breakdown: ${AppConfig.baseUrl}/pricing.md

## Conventions

- Assets: ${agentModeValue.conventions.asset_notation}
- Amounts: ${agentModeValue.conventions.amounts}
- Errors: ${agentModeValue.conventions.errors}
- Rate limits: ${agentModeValue.conventions.rate_limits}

## Safety

${agentModeValue.safety.map(rule => `- ${rule}`).join('\n')}

## More Discovery

${Object.entries(agentModeValue.discovery)
  .map(([key, url]) => `- ${key}: ${url}`)
  .join('\n')}
`
