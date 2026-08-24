import { NextRequest, NextResponse } from 'next/server'
import { AppConfig } from '@/config'
import { MCP_UI_RESOURCES, SWAP_QUOTE_UI_READ_RESULT, SWAP_QUOTE_UI_URI } from '@/lib/agent/mcp-ui'
import {
  ANONYMOUS_REQUEST_LIMIT,
  CORS_HEADERS,
  MCP_SERVER_INFO,
  MCP_TOOLS,
  SUPPORTED_PROTOCOL_VERSIONS,
  THORNODE_BASE,
  mcpServerCard
} from '@/lib/agent/mcp-tools'
import { rateLimit } from '@/lib/rate-limit'

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

// Pool depths and network parameters only change on THORChain's block cadence
// (~6s), so one in-flight request per path serves every caller asking for the
// same listing inside the window. Quotes are never cached: they carry an
// inbound address and an expiry, and a replayed quote is a wrong quote.
const LISTING_TTL_MS = 6_000
const listings = new Map<string, { at: number; body: Promise<unknown> }>()

function fetchListing(path: string) {
  const now = Date.now()
  const cached = listings.get(path)
  if (cached && now - cached.at < LISTING_TTL_MS) return cached.body

  const body = fetchThornode(path)
  listings.set(path, { at: now, body })
  // A failed fetch must not be served for the rest of the window.
  body.catch(() => {
    if (listings.get(path)?.body === body) listings.delete(path)
  })
  return body
}

class McpInvalidParams extends Error {}

function requireString(args: Record<string, unknown>, key: string) {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new McpInvalidParams(`"${key}" must be a non-empty string`)
  return value.trim()
}

function optionalString(args: Record<string, unknown>, key: string) {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !value.trim()) throw new McpInvalidParams(`"${key}" must be a non-empty string when provided`)
  return value.trim()
}

function optionalInteger(args: Record<string, unknown>, key: string, min: number, max: number) {
  const value = args[key]
  if (value === undefined || value === null) return undefined
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new McpInvalidParams(`"${key}" must be an integer between ${min} and ${max}`)
  }
  return parsed
}

/**
 * A bare filter ("ETH") means the chain, not every asset whose symbol happens
 * to contain those letters — otherwise an agent asking for Ethereum pools is
 * handed BASE.ETH and BSC.ETH-0X21…. A filter with a dot is a prefix match on
 * the whole asset, so "ETH.USDC" finds the contract-suffixed pool and
 * "BTC.BTC" finds exactly one.
 */
function matchesAsset(poolAsset: unknown, filter: string) {
  const asset = String(poolAsset).toUpperCase()
  return filter.includes('.') ? asset.startsWith(filter) : asset.startsWith(`${filter}.`)
}

// Arguments are validated per declared parameter; undeclared properties are
// ignored rather than rejected, so a client that decorates the call with its
// own keys still gets an answer.
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
    const status = optionalString(args, 'status')
    const asset = optionalString(args, 'asset')?.toUpperCase()
    const limit = optionalInteger(args, 'limit', 1, 200)

    const pools = await fetchListing('/pools')
    if (!Array.isArray(pools)) throw new Error('Unexpected pools response from THORNode')

    let matches = pools.filter(pool => {
      if (status && String(pool.status).toLowerCase() !== status.toLowerCase()) return false
      if (asset && !matchesAsset(pool.asset, asset)) return false
      return true
    })
    if (limit !== undefined) {
      matches = [...matches].sort((a, b) => Number(b.balance_rune ?? 0) - Number(a.balance_rune ?? 0)).slice(0, limit)
    }

    return matches.map(pool => ({
      asset: pool.asset,
      status: pool.status,
      balance_asset: pool.balance_asset,
      balance_rune: pool.balance_rune,
      asset_tor_price: pool.asset_tor_price
    }))
  }

  if (name === 'get_network_status') {
    const fields = args.fields
    // A wrong-typed `fields` is an error, not a silent full response: an agent
    // that asked for one key must never be handed the whole object instead.
    if (fields !== undefined && fields !== null && (!Array.isArray(fields) || !fields.every(field => typeof field === 'string'))) {
      throw new McpInvalidParams('"fields" must be an array of strings')
    }

    const network = await fetchListing('/network')
    if (!Array.isArray(fields) || !network || typeof network !== 'object') return network
    const source = network as Record<string, unknown>
    return Object.fromEntries((fields as string[]).filter(field => field in source).map(field => [field, source[field]]))
  }

  throw new McpInvalidParams(`Unknown tool: ${name}`)
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: unknown
  result?: unknown
  error?: { code: number; message: string }
}

function jsonRpcError(id: unknown, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function jsonRpcResult(id: unknown, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

/**
 * Handle one JSON-RPC message. Returns null for a notification, which carries
 * no response.
 */
async function handleMessage(message: unknown): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return jsonRpcError(null, -32600, 'Expected a JSON-RPC request object')
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
  if (id === undefined || id === null) return null

  if (method === 'initialize') {
    const requested = (params as { protocolVersion?: unknown } | undefined)?.protocolVersion
    const protocolVersion =
      typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0]
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

/**
 * Minimal stateless MCP server over streamable HTTP: single JSON responses,
 * no SSE stream, no sessions. Exposes read-only THORChain data tools.
 *
 * Arrays are accepted because the server offers to negotiate 2025-03-26 and
 * 2024-11-05, where a JSON-RPC batch is a valid request; a batch of nothing
 * but notifications gets the same empty 202 a single notification does.
 */
export async function handleMcpPost(req: NextRequest) {
  const retryAfter = rateLimit(req, 'mcp', ANONYMOUS_REQUEST_LIMIT)
  if (retryAfter !== null) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit exceeded' } },
      { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(retryAfter) } }
    )
  }

  let message: unknown
  try {
    message = await req.json()
  } catch {
    return Response.json(jsonRpcError(null, -32700, 'Parse error'), { headers: CORS_HEADERS })
  }

  if (Array.isArray(message)) {
    if (message.length === 0) return Response.json(jsonRpcError(null, -32600, 'Empty batch'), { headers: CORS_HEADERS })
    const responses = (await Promise.all(message.map(handleMessage))).filter(response => response !== null)
    if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS })
    return Response.json(responses, { headers: CORS_HEADERS })
  }

  const response = await handleMessage(message)
  if (!response) return new Response(null, { status: 202, headers: CORS_HEADERS })
  return Response.json(response, { headers: CORS_HEADERS })
}

/**
 * The server is stateless, so there is no SSE stream to open: a client asking
 * for one gets the 405 the MCP transport expects. Any other GET — a crawler,
 * an agent that only knows the endpoint URL — gets the server card, so the
 * manifest is reachable from the endpoint itself.
 */
export function handleMcpGet(req: NextRequest) {
  const accept = (req.headers.get('accept') || '').toLowerCase()
  if (accept.includes('text/event-stream')) {
    return NextResponse.json(
      { error: 'This MCP endpoint is stateless and does not offer an SSE stream. Send JSON-RPC requests via POST.' },
      { status: 405, headers: { ...CORS_HEADERS, Allow: 'POST' } }
    )
  }

  return NextResponse.json(mcpServerCard, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/mcp-server-card+json; charset=utf-8',
      Link: `<${AppConfig.baseUrl}/.well-known/mcp/server-card.json>; rel="mcp-server-card"`
    }
  })
}

export function handleMcpOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
