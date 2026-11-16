// Legacy discovery paths retained for existing clients. GET/HEAD mirror the
// core server card; POST/OPTIONS preserve their method when redirected to core.
export const MCP_ENDPOINT_ALIASES = new Set([
  '/.well-known/mcp/manifest.json',
  '/.well-known/mcp.json',
  '/.well-known/mcp/server-card.json',
  '/.well-known/mcp-server-card',
  '/.well-known/mcp-server-card.json',
  '/mcp.json'
])
