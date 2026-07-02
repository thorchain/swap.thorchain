import { AppConfig } from '@/config'

export function GET() {
  return Response.json({
    serverInfo: {
      name: 'thorchain-swap',
      version: '0.1.0'
    },
    transport: {
      type: 'streamable-http',
      endpoint: `${AppConfig.baseUrl}/.well-known/mcp`
    },
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  })
}
