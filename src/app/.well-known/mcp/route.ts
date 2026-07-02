export function GET() {
  return Response.json(
    {
      error: 'MCP transport is not enabled for public requests. See /.well-known/mcp/server-card.json for discovery metadata.'
    },
    { status: 501 }
  )
}

export const POST = GET
