import { AppConfig } from '@/config'

// Single source of truth for the developer portal content. Rendered as HTML at
// /developers and served verbatim as markdown at /developers.md.

export const developerEndpoints = [
  {
    method: 'POST',
    path: '/api/v1/newsletter',
    scope: 'submit:feedback',
    summary: 'Subscribe an email address to THORChain Swap updates.'
  },
  {
    method: 'POST',
    path: '/api/v1/report-bug',
    scope: 'submit:feedback',
    summary: 'Submit a bug report or feature request.'
  },
  {
    method: 'GET',
    path: '/.well-known/status',
    scope: 'read:public',
    summary: 'Discovery endpoint status.'
  }
]

export const developerMcpTools = [
  {
    name: 'get_swap_quote',
    summary: 'Fetch a THORChain swap quote for an asset pair (amounts in 1e8 base units).'
  },
  {
    name: 'list_pools',
    summary: 'List liquidity pools with status, depths, and USD asset price.'
  },
  {
    name: 'get_network_status',
    summary: 'Current THORChain network parameters.'
  }
]

export const developerScopes = [
  {
    scope: 'read:public',
    summary: 'Read public discovery documents, quotes, pools, and network data.'
  },
  {
    scope: 'submit:feedback',
    summary: 'Submit newsletter subscriptions and bug reports.'
  }
]

export const developerDiscoveryLinks = [
  { path: '/llms.txt', summary: 'index of agent resources' },
  { path: '/llms-full.md', summary: 'complete single-file agent reference (also at /llms-full.txt)' },
  { path: '/AGENTS.md', summary: 'guidance for AI agents using this site' },
  { path: '/developers.md', summary: 'this developer portal as markdown' },
  { path: '/.well-known/openapi.json', summary: 'OpenAPI 3.1 description of the public REST API' },
  { path: '/.well-known/api-catalog', summary: 'RFC 9727 API catalog (linkset)' },
  { path: '/.well-known/mcp-server-card', summary: 'MCP server card' },
  { path: '/.well-known/agent-card.json', summary: 'A2A agent card' },
  { path: '/.well-known/agent-skills/index.json', summary: 'published agent skills' },
  { path: '/.well-known/oauth-authorization-server', summary: 'OAuth 2.0 authorization server metadata' },
  { path: '/auth.md', summary: 'authentication model for agents' },
  { path: '/pricing.md', summary: 'pricing and per-swap fee model' },
  { path: '/?mode=agent', summary: 'structured agent view of the homepage (JSON with Accept: application/json)' },
  { path: '/sitemap.xml', summary: 'sitemap' },
  { path: '/robots.txt', summary: 'crawl policy with AI Content-Signal' }
]

export const mcpQuoteExample = `curl -s ${AppConfig.baseUrl}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_swap_quote",
      "arguments": {
        "from_asset": "BTC.BTC",
        "to_asset": "ETH.ETH",
        "amount": "100000000"
      }
    }
  }'`

export const errorExample = `{
  "error": "Invalid email",
  "code": "invalid_email",
  "hint": "Provide a valid email address in the \\"email\\" field.",
  "documentation": "${AppConfig.baseUrl}/developers"
}`

export const developersMarkdown = `# THORChain Developer Resources

THORChain developer resources for the swap interface — API docs, OpenAPI spec, auth docs, and MCP server — for THORChain Swap (${AppConfig.baseUrl}), the public web interface for native cross-chain swaps powered by THORChain and Maya Protocol.

- HTML version: ${AppConfig.baseUrl}/developers
- Markdown version: ${AppConfig.baseUrl}/developers.md

## Architecture

THORChain Swap consists of two components:

- **UI** — this web app. Users connect their own wallet and sign transactions locally, or swap without connecting a wallet via memoless ("instant") swaps.
- **Backend API** — the THORChain/Maya Protocol swap aggregator:
  - \`https://api.thorchain.org/v1\` — swap quotes and routes across THORChain and Maya Protocol providers. Requires an \`x-api-key\` header; keys are not self-service (contact the maintainers).
  - \`https://api.thorchain.org/memoless/api/v1\` — memoless (instant) swaps. No API key required.

The UI also reads protocol metadata (pools, network parameters, THORNames, balances, inbound addresses) directly from public THORNode and Midgard APIs. The keyless path for agents is the MCP server below, which serves quote, pool, and network data from THORNode.

## Quickstart

No API key or registration is required. Fetch a BTC → ETH swap quote through the public MCP server:

\`\`\`bash
${mcpQuoteExample}
\`\`\`

Amounts are strings in 1e8 base units (\`100000000\` = 1 BTC). Pass a \`destination\` address to receive a usable transaction memo. Quotes, memos, and inbound addresses expire; always re-fetch before use.

## MCP Server

A public, unauthenticated, rate-limited MCP server (streamable HTTP, stateless, JSON responses):

- Endpoint: ${AppConfig.baseUrl}/mcp
- Server card: ${AppConfig.baseUrl}/.well-known/mcp-server-card

Read-only tools:

${developerMcpTools.map(tool => `- \`${tool.name}\` — ${tool.summary}`).join('\n')}

The server supports MCP Apps (io.modelcontextprotocol/ui): \`get_swap_quote\` declares \`_meta.ui.resourceUri\` pointing at the \`ui://thorchain-swap/swap-quote\` resource (\`text/html;profile=mcp-app\`), which MCP Apps-capable hosts render as an interactive quote view. The view is self-contained (no external scripts) and receives data via \`ui/notifications/tool-result\`.

The server never holds keys, signs, or submits transactions.

## REST API

Described by the OpenAPI 3.1 document at ${AppConfig.baseUrl}/.well-known/openapi.json (alias: ${AppConfig.baseUrl}/openapi.json).

${developerEndpoints.map(endpoint => `- \`${endpoint.method} ${endpoint.path}\` — ${endpoint.summary} (scope: \`${endpoint.scope}\`)`).join('\n')}

### Idempotency

Both POST endpoints accept an \`Idempotency-Key\` header (any unique string, max 255 chars). A retry with the same key within one hour replays the original JSON response — marked with an \`Idempotency-Replayed: true\` response header — instead of re-executing the operation, so network-failure retries never duplicate a subscription or report. 429 and 5xx outcomes are not stored, so retrying after them can succeed.

### Versioning and Deprecation

The API is versioned in the URL path: \`/api/v1/\` is the canonical prefix, and the unversioned \`/api/*\` paths are stable aliases of the newest major version. Breaking changes ship as a new \`/api/vN\` prefix with at least six months of overlap. Endpoints scheduled for removal signal it with \`Deprecation\` and \`Sunset\` response headers and are announced on this page before retirement.

## Authentication and Scopes

Browsing, quoting, and the support APIs are anonymous today; there are no accounts, and users sign transactions in their own wallets (or use memoless swaps with no wallet connection). The aggregator quote API (\`https://api.thorchain.org/v1\`) is the exception: it requires an \`x-api-key\` header. The OAuth 2.0 model below defines least-privilege scopes for when self-service credential issuance is enabled:

${developerScopes.map(scope => `- \`${scope.scope}\` — ${scope.summary}`).join('\n')}

- Authorization server metadata: ${AppConfig.baseUrl}/.well-known/oauth-authorization-server
- Details: ${AppConfig.baseUrl}/auth.md

## Errors

Every non-2xx API response is JSON with a machine-readable \`code\`, human-readable \`error\`, and a resolution \`hint\`:

\`\`\`json
${errorExample}
\`\`\`

Rate limits return \`429\` with a \`Retry-After\` header (seconds). Unknown \`/api/*\` paths return a JSON \`404\` with code \`not_found\`.

## Sandbox

Test integrations against THORChain stagenet before touching mainnet funds:

- Stagenet THORNode API: https://stagenet-thornode.ninerealms.com
- Stagenet Midgard API: https://stagenet-midgard.ninerealms.com

## THORChain Protocol Resources

This site is an interface to the THORChain protocol. Protocol-level development (memos, inbound addresses, quote endpoints, node operation) is documented at:

- THORChain developer docs: https://dev.thorchain.org
- THORNode API: https://thornode.ninerealms.com/thorchain/doc
- Midgard API: https://midgard.ninerealms.com/v2/doc
- This interface's source code (with AGENTS.md instructions for AI coding agents): https://github.com/thorchain/swap.thorchain

## Discovery Resources

${developerDiscoveryLinks.map(link => `- [${link.path}](${AppConfig.baseUrl}${link.path}) — ${link.summary}`).join('\n')}

## Support

- Email: ${AppConfig.supportEmail}
- Discord: ${AppConfig.discordLink}
- Bug reports and feature requests: \`POST /api/report-bug\`
`
