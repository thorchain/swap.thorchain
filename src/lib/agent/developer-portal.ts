import { AppConfig } from '@/config'
import { CORE_MCP, CORE_MCP_TOOLS } from '@/lib/agent/core-mcp'
import { DEVELOPER_TOPICS } from '@/lib/agent/developer-topics'
import { SDK_PACKAGES } from '@/lib/agent/sdks'

// Single source of truth for the developer portal content. Rendered as HTML at
// /developers and served verbatim as markdown at /developers.md.

export const developerEndpoints = [
  {
    method: 'POST',
    path: '/api/v1/newsletter',
    authentication: 'none',
    summary: 'Subscribe an email address to THORChain Swap updates.'
  },
  {
    method: 'GET',
    path: '/.well-known/status',
    authentication: 'none',
    summary: 'Discovery endpoint status.'
  }
]

// Named developer resources, one topic per page: /developers/<slug> with a
// markdown twin at /developers/<slug>.md.
export const developerTopicLinks = DEVELOPER_TOPICS.map(topic => ({
  path: `/developers/${topic.slug}`,
  title: `THORChain Swap ${topic.navTitle}`,
  navTitle: topic.navTitle,
  description: topic.description
}))

export const developerMcpTools = CORE_MCP_TOOLS.map(tool => ({ name: tool.name, summary: tool.description }))

// Every path here is rendered as a link, so every path here must resolve. No
// `/.well-known/oauth-*` entry belongs in this list: the MCP server is
// anonymous, those documents deliberately 404, and linking them is what makes
// a connector attempt a sign-in flow that has nothing to sign in to (see
// docs/agent-readiness/orank.md).
export const developerDiscoveryLinks = [
  { path: '/llms.txt', summary: 'index of agent resources' },
  { path: '/.well-known/mcp.json', summary: 'live core MCP server-card mirror (also /mcp.json)' },
  { path: CORE_MCP.registryUrl, summary: `official registry entry: ${CORE_MCP.registryName}` },
  { path: '/llms-full.md', summary: 'complete single-file agent reference (also at /llms-full.txt)' },
  { path: '/AGENTS.md', summary: 'guidance for AI agents using this site' },
  { path: '/developers.md', summary: 'this developer portal as markdown' },
  { path: '/.well-known/openapi.json', summary: 'OpenAPI 3.1 description of the public REST API' },
  { path: '/.well-known/api-catalog', summary: 'RFC 9727 API catalog (linkset)' },
  { path: '/.well-known/mcp/server-card.json', summary: 'live core MCP server-card mirror with THORChain branding' },
  { path: '/.well-known/agent-card.json', summary: 'A2A agent card' },
  { path: '/.well-known/agent-skills/index.json', summary: 'published agent skills (navigation, quotes, pools, memoless swaps)' },
  { path: '/index.md', summary: 'homepage as markdown; append .md to any content page URL' },

  { path: '/auth.md', summary: 'authentication model for agents' },
  { path: '/pricing.md', summary: 'pricing and per-swap fee model' },
  { path: '/?mode=agent', summary: 'structured agent view of the homepage (JSON with Accept: application/json)' },
  { path: '/sitemap.xml', summary: 'sitemap' },
  { path: '/robots.txt', summary: 'crawl policy with AI Content-Signal' }
]

export const mcpQuoteExample = `curl -N -sS ${CORE_MCP.endpoint} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: 2025-06-18' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "quote_swap",
      "arguments": {
        "from_asset": "BTC.BTC",
        "to_asset": "ETH.ETH",
        "amount": 100000000
      }
    }
  }'`

// Illustrative SSE envelope; quote values are examples, never transaction instructions.
export const mcpResponseExample = `event: message
data: {"jsonrpc":"2.0","id":1,"result":{"structuredContent":{"data":{"expected_amount_out":"123456"},"_metadata":{"source_used":"thornode","canonical":true}},"content":[{"type":"text","text":"{\\"data\\":{\\"expected_amount_out\\":\\"123456\\"},\\"_metadata\\":{\\"source_used\\":\\"thornode\\",\\"canonical\\":true}}"}]}}
`

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

## Named Developer Resources

Each topic has its own page, and each page has a markdown twin at the same URL plus \`.md\`:

${developerTopicLinks.map(link => `- [${link.title}](${AppConfig.baseUrl}${link.path}) — ${link.description}`).join('\n')}

## Architecture

THORChain Swap consists of two components:

- **UI** — this web app. Users connect their own wallet and sign transactions locally, or swap without connecting a wallet via memoless ("instant") swaps.
- **Backend API** — the THORChain/Maya Protocol swap aggregator:
  - \`https://api.thorchain.org/v1\` — swap quotes and routes across THORChain and Maya Protocol providers. Requires an \`x-api-key\` header; keys are free through the affiliate program at ${AppConfig.affiliateLink} (register, verify your email, key issued on approval).
  - \`https://api.thorchain.org/memoless/api/v1\` — memoless (instant) swaps. No API key required.

The UI also reads protocol metadata (pools, network parameters, THORNames, balances, inbound addresses) directly from public THORNode and Midgard APIs. The keyless path for agents is the MCP server below, which serves THORChain data from THORNode and Midgard.

## Quickstart

No API key or registration is required. Fetch a BTC → ETH swap quote through the public MCP server:

\`\`\`bash
${mcpQuoteExample}
\`\`\`

The core MCP input \`amount\` is an integer in 1e8 base units (\`100000000\` = 1 BTC). The response is an SSE event containing JSON-RPC; read \`result.structuredContent.data\` for the quote and \`_metadata\` for its source. For executable deposit instructions use \`prepare_swap\` with a confirmed \`destination\`. Quotes, memos, and inbound addresses expire; always re-fetch before use.

## MCP Server

Use the canonical ${CORE_MCP.title} server, registered as [\`${CORE_MCP.registryName}\`](${CORE_MCP.registryUrl}):

- Endpoint: ${CORE_MCP.endpoint} — JSON-RPC over HTTP POST, no authentication
- Live server card: ${CORE_MCP.serverCard}
- This site's live card mirror: ${AppConfig.baseUrl}/.well-known/mcp/server-card.json (includes THORChain branding)
- Core source: ${CORE_MCP.repository}
- Full integration reference: ${AppConfig.baseUrl}/developers/mcp

Selected read-only tools (a subset; call \`tools/list\` for the complete live inventory):

${developerMcpTools.map(tool => `- \`${tool.name}\` — ${tool.summary}`).join('\n')}

Send \`Accept: application/json, text/event-stream\` and parse SSE \`data:\` events as JSON-RPC. A response has this shape (illustrative values):

\`\`\`text
${mcpResponseExample}
\`\`\`

The core server owns its tool schemas, protocol versions, capabilities, and rate limits; use its live card and \`tools/list\` as the authority. This site's legacy \`/mcp\` URL permanently redirects to the core endpoint. It does not translate the former tool contract. Configure new clients with the canonical URL directly.

The server never holds keys, signs, or submits transactions.

## SDKs

${SDK_PACKAGES.map(pkg => `- **${pkg.language}** — \`${pkg.name}\` (${pkg.ecosystem}): ${pkg.source}. ${pkg.status}`).join('\n')}

Full reference: ${AppConfig.baseUrl}/developers/sdks

## REST API

Described by the OpenAPI 3.1 document at ${AppConfig.baseUrl}/.well-known/openapi.json (alias: ${AppConfig.baseUrl}/openapi.json).

${developerEndpoints.map(endpoint => `- \`${endpoint.method} ${endpoint.path}\` — ${endpoint.summary} (auth: \`${endpoint.authentication}\`)`).join('\n')}

### Idempotency

The POST endpoint accepts an \`Idempotency-Key\` header (any unique string, max 255 chars). A retry with the same key within one hour replays the original JSON response — marked with an \`Idempotency-Replayed: true\` response header — instead of re-executing the operation, so network-failure retries never duplicate a subscription. 429 and 5xx outcomes are not stored, so retrying after them can succeed.

### Versioning and Deprecation

The API is versioned in the URL path: \`/api/v1/\` is the canonical prefix, and the unversioned \`/api/*\` paths are stable aliases of the newest major version. Breaking changes ship as a new \`/api/vN\` prefix with at least six months of overlap. Endpoints scheduled for removal signal it with \`Deprecation\` and \`Sunset\` response headers and are announced on this page before retirement.

## Authentication

Browsing, quoting, the public MCP server, and the support APIs are anonymous; there are no accounts, and users sign transactions in their own wallets (or use memoless swaps with no wallet connection).

This site runs no authorization server and issues no tokens: there is no \`/.well-known/oauth-protected-resource\` and no \`/.well-known/oauth-authorization-server\` to discover, so an MCP client that probes for authorization metadata finds none and connects directly. If a connector UI asks for an OAuth client ID or API key for \`${CORE_MCP.endpoint}\`, leave it blank.

The aggregator quote API (\`https://api.thorchain.org/v1\`) is a different system: it takes an \`x-api-key\`, issued free through the affiliate program at ${AppConfig.affiliateLink} after a short review. That same account sets affiliate/service fee splits, generates the embeddable widget, and reports earnings.

Details: ${AppConfig.baseUrl}/developers/auth and ${AppConfig.baseUrl}/auth.md

## Errors

Every non-2xx API response is JSON with a machine-readable \`code\`, human-readable \`error\`, and a resolution \`hint\`:

\`\`\`json
${errorExample}
\`\`\`

Rate limits return \`429\` with a \`Retry-After\` header (seconds). Unknown \`/api/*\` paths return a JSON \`404\` with code \`not_found\`.

## Sandbox

The hosted canonical core MCP endpoint uses mainnet. Test stagenet integrations with these dedicated APIs or a separately configured core server:

- Stagenet THORNode API: https://stagenet-thornode.ninerealms.com
- Stagenet Midgard API: https://stagenet-midgard.ninerealms.com

## THORChain Protocol Resources

This site is an interface to the THORChain protocol. Protocol-level development (memos, inbound addresses, quote endpoints, node operation) is documented at:

- THORChain developer docs: https://dev.thorchain.org
- THORNode API: https://thornode.ninerealms.com/thorchain/doc
- Midgard API: https://midgard.ninerealms.com/v2/doc
- This interface's source code (with AGENTS.md instructions for AI coding agents): https://github.com/thorchain/swap.thorchain

## Discovery Resources

${developerDiscoveryLinks.map(link => `- [${link.path}](${link.path.startsWith('https://') ? link.path : AppConfig.baseUrl + link.path}) — ${link.summary}`).join('\n')}

## Support

- Email: ${AppConfig.supportEmail}
`
