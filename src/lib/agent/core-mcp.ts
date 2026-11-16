import { AppConfig } from '@/config'

// The core service owns its tool surface and Registry publication. The swap
// interface links to it; it must never publish the retired three-tool server
// under the core identity. Read the live card for versions and the full list.
export const CORE_MCP = {
  registryName: 'org.thorchain/thorchain-mcp',
  registryUrl: 'https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/latest',
  name: 'thorchain-mcp',
  title: 'THORChain MCP',
  endpoint: 'https://mcp.thorchain.org/mcp',
  serverCard: 'https://mcp.thorchain.org/.well-known/mcp/server-card.json',
  repository: 'https://gitlab.com/thorchain/thorchain-mcp',
  documentation: 'https://gitlab.com/thorchain/thorchain-mcp/-/blob/main/README.md'
} as const

// A documented subset, not a replacement for the canonical tools/list. Keep
// example names and argument types checked against the live core contract.
export const CORE_MCP_TOOLS = [
  {
    name: 'quote_swap',
    title: 'Get Swap Quote',
    description: 'Read indicative THORChain swap output, fees, slippage, and timing.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['from_asset', 'to_asset', 'amount'],
      properties: {
        from_asset: { type: 'string', description: 'Source asset, e.g. BTC.BTC.' },
        to_asset: { type: 'string', description: 'Destination asset, e.g. ETH.ETH.' },
        amount: { type: 'integer', description: 'Amount in 1e8 base units.' },
        destination: { type: 'string', description: 'Destination address for the swap output.' },
        affiliate: { type: 'string', description: 'Affiliate address or THORName.' },
        affiliate_bps: { type: 'integer', description: 'Affiliate fee in basis points (0-1000).' }
      }
    }
  },
  {
    name: 'list_pools',
    title: 'List Liquidity Pools',
    description: 'Read THORChain pools from Midgard with pagination.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', description: 'Maximum results (default 100, maximum 1000).' },
        offset: { type: 'integer', description: 'Results to skip for pagination.' }
      }
    }
  },
  {
    name: 'get_network_summary',
    title: 'Get Network Summary',
    description: 'Read node counts, APY, reserve, pooled RUNE, churn height, and vault migration state.',
    inputSchema: { type: 'object', additionalProperties: false }
  }
]

export function redirectToCoreMcp() {
  // 308 preserves POST and its JSON-RPC body. Clients should configure the
  // canonical URL directly: old tool names and JSON-only/SSE assumptions are
  // not compatible merely because a client follows this redirect.
  return new Response(null, {
    status: 308,
    headers: { Location: CORE_MCP.endpoint, 'Cache-Control': 'public, max-age=300' }
  })
}

export async function coreMcpServerCardResponse(method: string) {
  try {
    const upstream = await fetch(CORE_MCP.serverCard, { signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!upstream.ok) throw new Error('Core server card is unavailable')
    const card = await upstream.json()
    if (card.name !== CORE_MCP.name || card.serverUrl !== CORE_MCP.endpoint || !Array.isArray(card.tools)) {
      throw new Error('Core server card has an unexpected identity')
    }
    const icon = `${AppConfig.baseUrl}${AppConfig.logo}`
    const body = JSON.stringify(
      {
        ...card,
        title: card.title || CORE_MCP.title,
        icon: card.icon || icon,
        icons: card.icons?.length ? card.icons : [{ src: card.icon || icon, mimeType: 'image/svg+xml' }],
        registry: { name: CORE_MCP.registryName, url: CORE_MCP.registryUrl }
      },
      null,
      2
    )
    return new Response(method === 'HEAD' ? null : body, {
      headers: {
        'Content-Type': 'application/mcp-server-card+json; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        Link: `<${CORE_MCP.serverCard}>; rel="canonical"`
      }
    })
  } catch {
    // Do not fall back to the old swap tool surface under the core identity.
    return Response.json(
      { error: 'Canonical MCP server card unavailable', canonical: CORE_MCP.serverCard },
      {
        status: 502,
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }
}
