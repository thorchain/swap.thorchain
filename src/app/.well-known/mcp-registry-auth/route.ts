// Legacy domain proof retained for existing deployments. The canonical core
// MCP identity and registry publication are owned by the core repository;
// this swap deployment must not publish a competing listing.
//
// The value is a single line: `v=MCPv1; k=ed25519; p=<base64 public key>`.
// It is a public key, so it is safe to serve; it lives in an environment
// variable rather than the repo so rotating it needs no deploy of new code.
// See docs/agent-readiness/mcp-registry.md.
export function GET() {
  const proof = process.env.MCP_REGISTRY_AUTH?.trim()
  if (!proof) return new Response('Not found', { status: 404 })

  return new Response(`${proof}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  })
}
