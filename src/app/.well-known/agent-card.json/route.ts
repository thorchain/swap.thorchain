import { AppConfig } from '@/config'

export function GET() {
  return Response.json(
    {
      name: 'THORChain Swap',
      description: 'Public discovery card for the THORChain Swap web interface.',
      version: '0.1.0',
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false
      },
      supportedInterfaces: [
        {
          url: AppConfig.baseUrl,
          protocolBinding: 'HTTP+JSON',
          protocolVersion: '1.0.0'
        },
        {
          url: `${AppConfig.baseUrl}/mcp`,
          protocolBinding: 'MCP',
          protocolVersion: '2025-06-18'
        }
      ],
      defaultInputModes: ['text/plain', 'application/json'],
      defaultOutputModes: ['text/plain', 'application/json'],
      skills: [
        {
          id: 'inspect-public-discovery',
          name: 'Inspect Public Discovery',
          description: 'Read public discovery documents for the THORChain Swap interface.',
          tags: ['discovery', 'thorchain', 'swap'],
          inputModes: ['text/plain', 'application/json'],
          outputModes: ['text/plain', 'application/json']
        }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/a2a+json; charset=utf-8'
      }
    }
  )
}
