import { AppConfig } from '@/config'
import { developerEndpoints, developerScopes } from '@/lib/agent/developer-portal'
import { MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/agent/mcp-server'
import { pricingPlans } from '@/lib/agent/pricing'

// The ?mode=agent view of the homepage: capabilities, endpoints, auth, and
// pricing as data instead of the client-rendered swap UI. Served by
// src/proxy.ts — JSON when the client accepts it, markdown otherwise.

const capabilities = [
  {
    id: 'swap-quote',
    summary: 'Fetch a live cross-chain swap quote (expected output, itemised fees, slippage, memo, inbound address).',
    access: `MCP tool get_swap_quote at ${AppConfig.baseUrl}/mcp`,
    authentication: 'none'
  },
  {
    id: 'list-pools',
    summary: 'List THORChain liquidity pools with status, depths, and USD asset price.',
    access: `MCP tool list_pools at ${AppConfig.baseUrl}/mcp`,
    authentication: 'none'
  },
  {
    id: 'network-status',
    summary: 'Read current THORChain network parameters, outbound fees, and halt state.',
    access: `MCP tool get_network_status at ${AppConfig.baseUrl}/mcp`,
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
    id: 'submit-feedback',
    summary: 'Subscribe to updates or file a bug report through the public REST API.',
    access: `POST ${AppConfig.baseUrl}/api/v1/newsletter, POST ${AppConfig.baseUrl}/api/v1/report-bug`,
    authentication: 'none (rate limited, Idempotency-Key supported)'
  }
]

const notSupported = [
  'Executing or signing a swap on a user behalf — the server holds no keys and never submits transactions.',
  'Fiat on/off-ramps, NFTs, derivatives, or custodial accounts.',
  'Self-service API key or OAuth credential issuance.'
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
    summary:
      'Browsing, quoting, and the support APIs require no credentials. The swap aggregator backend (https://api.thorchain.org/v1) requires an x-api-key that is not self-service; the memoless API and the MCP server need no key.',
    scopes: developerScopes.map(({ scope, summary }) => ({ scope, summary })),
    documentation: `${AppConfig.baseUrl}/auth.md`,
    oauth_metadata: `${AppConfig.baseUrl}/.well-known/oauth-authorization-server`
  },
  endpoints: {
    mcp: {
      url: `${AppConfig.baseUrl}/mcp`,
      transport: 'streamable-http',
      protocolVersion: '2025-06-18',
      serverInfo: MCP_SERVER_INFO,
      serverCard: `${AppConfig.baseUrl}/.well-known/mcp-server-card.json`,
      authentication: 'none',
      tools: MCP_TOOLS.map(({ name, description }) => ({ name, description }))
    },
    rest: developerEndpoints.map(({ method, path, scope, summary }) => ({
      method,
      url: `${AppConfig.baseUrl}${path}`,
      scope,
      summary
    })),
    openapi: `${AppConfig.baseUrl}/openapi.json`,
    upstream: {
      aggregator: 'https://api.thorchain.org/v1',
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
    amounts: 'strings in 1e8 base units (1 BTC = 100000000)',
    errors: 'JSON with error, code, hint, and documentation fields',
    rate_limits: '429 with a Retry-After header'
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

${developerScopes.map(s => `- \`${s.scope}\` — ${s.summary}`).join('\n')}

Details: ${AppConfig.baseUrl}/auth.md · OAuth metadata: ${AppConfig.baseUrl}/.well-known/oauth-authorization-server

## Endpoints

MCP server (streamable HTTP, stateless, no key) — ${AppConfig.baseUrl}/mcp

${MCP_TOOLS.map(tool => `- \`${tool.name}\` — ${tool.description}`).join('\n')}

REST:

${developerEndpoints.map(e => `- \`${e.method} ${AppConfig.baseUrl}${e.path}\` — ${e.summary} (scope: \`${e.scope}\`)`).join('\n')}

OpenAPI description: ${AppConfig.baseUrl}/openapi.json

Upstream swap APIs the UI itself uses: https://api.thorchain.org/v1 (quotes and routing, \`x-api-key\` gated) and https://api.thorchain.org/memoless/api/v1 (memoless swaps, no key).

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
