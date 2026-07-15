import { NextRequest, NextResponse } from 'next/server'
import { MCP_UI_RESOURCES, SWAP_QUOTE_UI_READ_RESULT, SWAP_QUOTE_UI_URI } from '@/lib/agent/mcp-ui'
import { rateLimit } from '@/lib/rate-limit'

// Same THORNode gateway the app itself uses (see src/lib/thorchain-api.ts).
const THORNODE_BASE = 'https://gateway.liquify.com/chain/thorchain_api/thorchain'

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

export const MCP_SERVER_INFO = {
  name: 'thorchain-swap',
  title: 'THORChain Swap',
  version: '0.3.0'
}

export const MCP_TOOLS = [
  {
    name: 'get_swap_quote',
    title: 'Get Swap Quote',
    description:
      'Fetch a THORChain swap quote for an asset pair. Assets use CHAIN.SYMBOL notation (e.g. BTC.BTC, ETH.ETH, ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48). Amount is in 1e8 base units (1 BTC = 100000000). Quotes are indicative and expire quickly; the returned memo and inbound address must not be reused after expiry.',
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
    description: 'List available THORChain liquidity pools with status, depths (1e8 base units), and USD asset price.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'get_network_status',
    title: 'Get Network Status',
    description: 'Return current THORChain network parameters, including outbound fees and halt-related gas information.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  }
]

async function fetchThornode(path: string) {
  const res = await fetch(`${THORNODE_BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body && typeof body.message === 'string' ? body.message : `THORNode responded with status ${res.status}`
    throw new Error(message)
  }
  return body
}

class McpInvalidParams extends Error {}

function requireString(args: Record<string, unknown>, key: string) {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new McpInvalidParams(`"${key}" must be a non-empty string`)
  return value.trim()
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === 'get_swap_quote') {
    const params = new URLSearchParams({
      from_asset: requireString(args, 'from_asset'),
      to_asset: requireString(args, 'to_asset'),
      amount: requireString(args, 'amount')
    })
    if (typeof args.destination === 'string' && args.destination.trim()) params.set('destination', args.destination.trim())
    if (typeof args.streaming_interval === 'string' && args.streaming_interval.trim()) {
      params.set('streaming_interval', args.streaming_interval.trim())
    }
    return fetchThornode(`/quote/swap?${params}`)
  }

  if (name === 'list_pools') {
    const pools = await fetchThornode('/pools')
    if (!Array.isArray(pools)) throw new Error('Unexpected pools response from THORNode')
    return pools.map(pool => ({
      asset: pool.asset,
      status: pool.status,
      balance_asset: pool.balance_asset,
      balance_rune: pool.balance_rune,
      asset_tor_price: pool.asset_tor_price
    }))
  }

  if (name === 'get_network_status') {
    return fetchThornode('/network')
  }

  throw new McpInvalidParams(`Unknown tool: ${name}`)
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

function jsonRpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: '2.0', id, result })
}

/**
 * Minimal stateless MCP server over streamable HTTP: single JSON responses,
 * no SSE stream, no sessions. Exposes read-only THORChain data tools.
 */
export async function handleMcpPost(req: NextRequest) {
  const retryAfter = rateLimit(req, 'mcp', 60)
  if (retryAfter !== null) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit exceeded' } },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  let message: unknown
  try {
    message = await req.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return jsonRpcError(null, -32600, 'Expected a single JSON-RPC request object')
  }

  const { jsonrpc, id, method, params } = message as {
    jsonrpc?: unknown
    id?: unknown
    method?: unknown
    params?: unknown
  }

  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return jsonRpcError(id, -32600, 'Invalid JSON-RPC request')
  }

  // Notifications (no id) are accepted and ignored.
  if (id === undefined || id === null) {
    return new Response(null, { status: 202 })
  }

  if (method === 'initialize') {
    const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion
    const protocolVersion =
      typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0]
    return jsonRpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false }, resources: { listChanged: false, subscribe: false } },
      serverInfo: MCP_SERVER_INFO,
      instructions:
        'Read-only THORChain data tools. Quotes are indicative and time-sensitive. This server never holds keys, signs, or submits transactions; users sign in their own wallets.'
    })
  }

  if (method === 'ping') {
    return jsonRpcResult(id, {})
  }

  if (method === 'tools/list') {
    return jsonRpcResult(id, { tools: MCP_TOOLS })
  }

  if (method === 'resources/list') {
    return jsonRpcResult(id, { resources: MCP_UI_RESOURCES })
  }

  if (method === 'resources/templates/list') {
    return jsonRpcResult(id, { resourceTemplates: [] })
  }

  if (method === 'resources/read') {
    const uri = (params as { uri?: unknown } | undefined)?.uri
    if (uri !== SWAP_QUOTE_UI_URI) return jsonRpcError(id, -32002, `Resource not found: ${String(uri)}`)
    return jsonRpcResult(id, SWAP_QUOTE_UI_READ_RESULT)
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = (params ?? {}) as { name?: unknown; arguments?: unknown }
    if (typeof name !== 'string') return jsonRpcError(id, -32602, '"name" is required')
    const toolArgs = args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>) : {}
    try {
      const data = await callTool(name, toolArgs)
      const result: Record<string, unknown> = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
      // The swap-quote UI view consumes structuredContent.
      if (name === 'get_swap_quote' && data && typeof data === 'object' && !Array.isArray(data)) {
        result.structuredContent = data
      }
      return jsonRpcResult(id, result)
    } catch (err) {
      if (err instanceof McpInvalidParams) return jsonRpcError(id, -32602, err.message)
      const text = err instanceof Error ? err.message : 'Tool execution failed'
      return jsonRpcResult(id, { content: [{ type: 'text', text }], isError: true })
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`)
}

export function handleMcpGet() {
  return NextResponse.json(
    { error: 'This MCP endpoint is stateless and does not offer an SSE stream. Send JSON-RPC requests via POST.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
