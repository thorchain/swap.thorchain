import { AppConfig } from '@/config'
import {
  agentSkillDigest,
  agentSkillMarkdown,
  agentsMarkdown,
  authMarkdown,
  llmsFullMarkdown,
  llmsTxt
} from '@/lib/agent/discovery'
import { developersMarkdown } from '@/lib/agent/developer-portal'
import { pricingMarkdown } from '@/lib/agent/pricing'
import { MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/agent/mcp-server'
import { MCP_UI_RESOURCES } from '@/lib/agent/mcp-ui'
import { buildOpenApiDocument } from '@/lib/agent/openapi'

// Static discovery files by path, served by src/proxy.ts ahead of the
// filesystem routes. Add new surfaces here; only dynamic endpoints
// (/mcp, /agent-auth/*, /api/*) need route folders.

const MARKDOWN = 'text/markdown; charset=utf-8'
const JSON_TYPE = 'application/json; charset=utf-8'

const json = (value: unknown) => JSON.stringify(value, null, 2)

const openApiBody = json(buildOpenApiDocument())

const mcpServerCard = json({
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

const agentsJson = json({
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
    auth: `${AppConfig.baseUrl}/auth.md`,
    pricing: `${AppConfig.baseUrl}/pricing.md`,
    agentMode: `${AppConfig.baseUrl}/?mode=agent`
  }
})

const agentCard = json({
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
})

const apiCatalogEntry = (anchor: string) => ({
  anchor: `${AppConfig.baseUrl}${anchor}`,
  'service-desc': [
    {
      href: `${AppConfig.baseUrl}/.well-known/openapi.json`,
      type: 'application/vnd.oai.openapi+json'
    }
  ],
  'service-doc': [
    {
      href: `${AppConfig.baseUrl}/developers.md`,
      type: 'text/markdown'
    },
    {
      href: `${AppConfig.baseUrl}/auth.md`,
      type: 'text/markdown'
    }
  ],
  status: [
    {
      href: `${AppConfig.baseUrl}/.well-known/status`,
      type: 'application/json'
    }
  ]
})

const apiCatalog = json({
  linkset: [apiCatalogEntry('/api/v1/newsletter'), apiCatalogEntry('/api/v1/report-bug')]
})

const agentSkillsIndex = json({
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [
    {
      name: 'thorchain-swap',
      type: 'skill-md',
      description: 'Navigate and inspect the public THORChain Swap interface safely.',
      url: `${AppConfig.baseUrl}/.well-known/agent-skills/thorchain-swap/SKILL.md`,
      digest: agentSkillDigest
    }
  ]
})

const oauthAuthorizationServer = json({
  issuer: AppConfig.baseUrl,
  authorization_endpoint: `${AppConfig.baseUrl}/agent-auth/authorize`,
  token_endpoint: `${AppConfig.baseUrl}/agent-auth/token`,
  jwks_uri: `${AppConfig.baseUrl}/.well-known/jwks.json`,
  grant_types_supported: ['authorization_code'],
  response_types_supported: ['code'],
  scopes_supported: ['read:public', 'submit:feedback'],
  token_endpoint_auth_methods_supported: ['client_secret_basic'],
  service_documentation: `${AppConfig.baseUrl}/auth.md`,
  agent_auth: {
    skill: 'auth.md',
    register_uri: `${AppConfig.baseUrl}/auth.md`,
    identity_types_supported: ['anonymous'],
    anonymous: {
      credential_types_supported: ['none'],
      claim_uri: `${AppConfig.baseUrl}/auth.md`
    }
  }
})

const oauthProtectedResource = json({
  resource: AppConfig.baseUrl,
  authorization_servers: [AppConfig.baseUrl],
  scopes_supported: ['read:public', 'submit:feedback'],
  bearer_methods_supported: ['header']
})

const status = json({
  status: 'ok',
  service: 'thorchain-swap',
  url: AppConfig.baseUrl
})

const jwks = json({ keys: [] })

// Homepage markdown variant, served when a client Accepts text/markdown on /.
export const homeMarkdown = `# THORChain Swap

THORChain Swap is the public swap interface for THORChain powered cross-chain swaps.

## Public Pages

- [Swap interface](${AppConfig.baseUrl}/)
- [Pool interface](https://pool.thorchain.org/)
- [Bond interface](https://bond.thorchain.org/)
- [Memo interface](https://memo.thorchain.org/)
- [TCY interface](https://tcy.thorchain.org/)
- [THORName interface](https://thorname.thorchain.org/)

## Developer Resources

- [Developer portal](${AppConfig.baseUrl}/developers)
- [Developer portal (markdown)](${AppConfig.baseUrl}/developers.md)
- [Pricing](${AppConfig.baseUrl}/pricing.md)
- [Source code](https://github.com/thorchain/swap.thorchain)

## Machine-Readable Discovery

- [llms.txt](${AppConfig.baseUrl}/llms.txt)
- [Agent library (full)](${AppConfig.baseUrl}/llms-full.md)
- [AGENTS.md](${AppConfig.baseUrl}/AGENTS.md)
- [MCP server card](${AppConfig.baseUrl}/.well-known/mcp-server-card)
- [robots.txt](${AppConfig.baseUrl}/robots.txt)
- [sitemap.xml](${AppConfig.baseUrl}/sitemap.xml)
- [API catalog](${AppConfig.baseUrl}/.well-known/api-catalog)
- [OpenAPI description](${AppConfig.baseUrl}/.well-known/openapi.json)
- [Agent skills index](${AppConfig.baseUrl}/.well-known/agent-skills/index.json)
- [Auth.md](${AppConfig.baseUrl}/auth.md)
- [Agent view of this page](${AppConfig.baseUrl}/?mode=agent)
`

export interface DiscoveryFile {
  contentType: string
  body: string
}

export const discoveryFiles: Record<string, DiscoveryFile> = {
  '/llms.txt': { contentType: MARKDOWN, body: llmsTxt },
  '/llms-full.md': { contentType: MARKDOWN, body: llmsFullMarkdown },
  '/llms-full.txt': { contentType: MARKDOWN, body: llmsFullMarkdown },
  '/AGENTS.md': { contentType: MARKDOWN, body: agentsMarkdown },
  '/auth.md': { contentType: MARKDOWN, body: authMarkdown },
  '/developers.md': { contentType: MARKDOWN, body: developersMarkdown },
  '/pricing.md': { contentType: MARKDOWN, body: pricingMarkdown },
  '/agents.json': { contentType: JSON_TYPE, body: agentsJson },
  '/openapi.json': { contentType: 'application/vnd.oai.openapi+json; charset=utf-8', body: openApiBody },
  '/.well-known/openapi.json': { contentType: 'application/vnd.oai.openapi+json; charset=utf-8', body: openApiBody },
  '/.well-known/mcp-server-card': { contentType: JSON_TYPE, body: mcpServerCard },
  '/.well-known/mcp-server-card.json': { contentType: JSON_TYPE, body: mcpServerCard },
  '/.well-known/agent-card.json': { contentType: 'application/a2a+json; charset=utf-8', body: agentCard },
  '/.well-known/api-catalog': { contentType: 'application/linkset+json; charset=utf-8', body: apiCatalog },
  '/.well-known/agent-skills/index.json': { contentType: JSON_TYPE, body: agentSkillsIndex },
  '/.well-known/agent-skills/thorchain-swap/SKILL.md': { contentType: MARKDOWN, body: agentSkillMarkdown },
  '/.well-known/oauth-authorization-server': { contentType: JSON_TYPE, body: oauthAuthorizationServer },
  '/.well-known/oauth-protected-resource': { contentType: JSON_TYPE, body: oauthProtectedResource },
  '/.well-known/status': { contentType: JSON_TYPE, body: status },
  '/.well-known/jwks.json': { contentType: JSON_TYPE, body: jwks }
}
