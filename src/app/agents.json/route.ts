import { AppConfig } from '@/config'
import { MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/mcp-server'

export function GET() {
  return Response.json({
    name: 'THORChain Swap',
    description: 'Public web interface for native cross-chain swaps powered by THORChain and Maya Protocol.',
    url: AppConfig.baseUrl,
    documentation: `${AppConfig.baseUrl}/AGENTS.md`,
    mcp: {
      serverInfo: MCP_SERVER_INFO,
      transport: {
        type: 'streamable-http',
        endpoint: `${AppConfig.baseUrl}/mcp`
      },
      serverCard: `${AppConfig.baseUrl}/.well-known/mcp-server-card.json`,
      authentication: { type: 'none' },
      tools: MCP_TOOLS.map(({ name, description }) => ({ name, description }))
    },
    apis: {
      openapi: `${AppConfig.baseUrl}/openapi.json`,
      catalog: `${AppConfig.baseUrl}/.well-known/api-catalog`
    },
    discovery: {
      llms: `${AppConfig.baseUrl}/llms.txt`,
      agents: `${AppConfig.baseUrl}/AGENTS.md`,
      skills: `${AppConfig.baseUrl}/.well-known/agent-skills/index.json`,
      agentCard: `${AppConfig.baseUrl}/.well-known/agent-card.json`,
      auth: `${AppConfig.baseUrl}/auth.md`
    }
  })
}
