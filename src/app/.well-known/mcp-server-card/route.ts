import { AppConfig } from '@/config'
import { MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/mcp-server'

export function GET() {
  return Response.json({
    serverInfo: MCP_SERVER_INFO,
    protocolVersion: '2025-06-18',
    transport: {
      type: 'streamable-http',
      endpoint: `${AppConfig.baseUrl}/mcp`
    },
    authentication: { type: 'none' },
    capabilities: {
      tools: { listChanged: false }
    },
    tools: MCP_TOOLS.map(({ name, description }) => ({ name, description })),
    documentation: `${AppConfig.baseUrl}/AGENTS.md`
  })
}
