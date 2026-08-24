import { AppConfig } from '@/config'
import { MCP_UI_RESOURCES, SWAP_QUOTE_UI_URI } from '@/lib/agent/mcp-ui'

// Tool definitions and the server manifest for the public MCP server. Kept
// separate from the request handlers (src/lib/agent/mcp-server.ts) because the
// discovery-file registry — and therefore src/proxy.ts, which runs on the edge
// runtime — needs these values without pulling in node:crypto.

// Same THORNode gateway the app itself uses (see src/lib/thorchain-api.ts).
export const THORNODE_BASE = 'https://gateway.liquify.com/chain/thorchain_api/thorchain'

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

export const MCP_SERVER_INFO = {
  name: 'thorchain-swap',
  title: 'THORChain Swap',
  version: '0.4.1'
}

// Requests per 10-minute window, keyed by client IP.
export const ANONYMOUS_REQUEST_LIMIT = 60

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Retry-After',
  'Access-Control-Max-Age': '86400'
}

const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
}

export const MCP_TOOLS = [
  {
    name: 'get_swap_quote',
    title: 'Get Swap Quote',
    description:
      'Fetch a THORChain swap quote for an asset pair. Assets use CHAIN.SYMBOL notation (e.g. BTC.BTC, ETH.ETH, ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48). Amount is in 1e8 base units (1 BTC = 100000000). Quotes are indicative and expire quickly; the returned memo and inbound address must not be reused after expiry.',
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      required: ['from_asset', 'to_asset', 'amount'],
      properties: {
        from_asset: { type: 'string', description: 'Source asset, e.g. BTC.BTC' },
        to_asset: { type: 'string', description: 'Destination asset, e.g. ETH.ETH' },
        amount: { type: 'string', description: 'Amount to swap in 1e8 base units' },
        destination: { type: 'string', description: 'Optional destination address; required for a quote with a usable memo' },
        streaming_interval: { type: 'string', description: 'Optional streaming swap interval in blocks' }
      },
      additionalProperties: false
    },
    // MCP Apps hosts render the quote in the swap-quote view; others ignore _meta.
    _meta: {
      ui: {
        resourceUri: SWAP_QUOTE_UI_URI,
        visibility: ['model', 'app']
      }
    }
  },
  {
    name: 'list_pools',
    title: 'List Liquidity Pools',
    description:
      'List THORChain liquidity pools with status, depths (1e8 base units), and USD asset price. Filter by pool status or by chain/asset to avoid pulling the full list.',
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      required: [],
      properties: {
        status: {
          type: 'string',
          enum: ['Available', 'Staged', 'Suspended'],
          description: 'Only return pools in this state. Available pools are the tradable ones.'
        },
        asset: {
          type: 'string',
          description:
            'Case-insensitive filter on the pool asset. A bare chain returns that chain only (ETH matches every ETH.* pool, not BASE.ETH); a CHAIN.SYMBOL value matches by prefix, so BTC.BTC returns one pool and ETH.USDC finds the contract-suffixed pool.'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: 'Maximum number of pools to return, largest RUNE depth first. Omit to return every match.'
        }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_network_status',
    title: 'Get Network Status',
    description:
      'Return current THORChain network parameters, including outbound fees, bond and reserve totals, and halt-related gas information. Pass `fields` to return only the keys you need.',
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
    inputSchema: {
      type: 'object',
      required: [],
      properties: {
        fields: {
          type: 'array',
          description: 'Subset of top-level keys to return, e.g. ["native_outbound_fee_rune", "outbound_fee_multiplier"]. Omit for the full object.',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 40
        }
      },
      additionalProperties: false
    }
  }
]

// Paths that serve the manifest on GET and must also speak the transport: a
// client (or a readiness scanner) that discovers one of these and posts
// JSON-RPC at it should reach the server, not the 404 page. src/proxy.ts
// rewrites POST and OPTIONS on each of them to /mcp.
export const MCP_ENDPOINT_ALIASES = new Set([
  '/.well-known/mcp/manifest.json',
  '/.well-known/mcp.json',
  '/.well-known/mcp/server-card.json',
  '/.well-known/mcp-server-card',
  '/.well-known/mcp-server-card.json',
  '/mcp.json'
])

// The MCP server manifest. Served at /.well-known/mcp/server-card.json and its
// aliases through the discovery-file registry, and by GET /mcp itself so a
// client that only knows the endpoint URL can still read the manifest.
export const mcpServerCard = {
  name: MCP_SERVER_INFO.name,
  description: 'Read-only THORChain quote, liquidity-pool, and network-status tools. The server never holds keys, signs, or submits transactions.',
  version: MCP_SERVER_INFO.version,
  serverInfo: MCP_SERVER_INFO,
  protocolVersion: '2025-06-18',
  // The endpoint is stated four ways because manifest readers disagree about
  // where to look: `serverUrl`, a `transport` object, a bare `endpoint`, and
  // the `remotes` array the official registry record uses. All four are the
  // same URL, so none of them can drift.
  serverUrl: `${AppConfig.baseUrl}/mcp`,
  endpoint: `${AppConfig.baseUrl}/mcp`,
  transport: {
    type: 'streamable-http',
    endpoint: `${AppConfig.baseUrl}/mcp`
  },
  remotes: [
    {
      type: 'streamable-http',
      url: `${AppConfig.baseUrl}/mcp`
    }
  ],
  // No authorization of any kind: no key, no token, no OAuth. Clients that
  // probe for authorization metadata find none and connect directly.
  authentication: { type: 'none' },
  capabilities: {
    tools: { listChanged: false },
    resources: { listChanged: false, subscribe: false }
  },
  tools: MCP_TOOLS,
  resources: MCP_UI_RESOURCES,
  documentation: `${AppConfig.baseUrl}/AGENTS.md`
}
