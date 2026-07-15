import { AppConfig } from '@/config'
import { MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/mcp-server'
import { MCP_UI_RESOURCES } from '@/lib/mcp-ui'

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
      tools: { listChanged: false },
      resources: { listChanged: false, subscribe: false }
    },
    tools: MCP_TOOLS,
    resources: MCP_UI_RESOURCES,
    documentation: `${AppConfig.baseUrl}/AGENTS.md`
  })
}
