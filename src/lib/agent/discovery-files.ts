import { AppConfig } from '@/config'
import { agentsMarkdown, authMarkdown, llmsFullMarkdown, llmsTxt } from '@/lib/agent/discovery'
import { developersMarkdown } from '@/lib/agent/developer-portal'
import { AGENT_SKILLS } from '@/lib/agent/skills'
import { pricingMarkdown } from '@/lib/agent/pricing'
import { MCP_SERVER_INFO, MCP_TOOLS } from '@/lib/agent/mcp-server'
import { MCP_UI_RESOURCES } from '@/lib/agent/mcp-ui'
import { buildOpenApiDocument } from '@/lib/agent/openapi'

// Static discovery files by path, served by src/proxy.ts ahead of the
// filesystem routes. Add new surfaces here; only dynamic endpoints
// (/mcp and /api/*) need route folders.

const MARKDOWN = 'text/markdown; charset=utf-8'
const JSON_TYPE = 'application/json; charset=utf-8'

const json = (value: unknown) => JSON.stringify(value, null, 2)

const openApiBody = json(buildOpenApiDocument())

const mcpServerCard = json({
  name: MCP_SERVER_INFO.name,
  description: 'Read-only THORChain quote, liquidity-pool, and network-status tools. The server never holds keys, signs, or submits transactions.',
  version: MCP_SERVER_INFO.version,
  serverInfo: MCP_SERVER_INFO,
  protocolVersion: '2025-06-18',
  serverUrl: `${AppConfig.baseUrl}/mcp`,
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
    serverCard: `${AppConfig.baseUrl}/.well-known/mcp/server-card.json`,
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
    aiCatalog: `${AppConfig.baseUrl}/.well-known/ai-catalog.json`,
    agentCard: `${AppConfig.baseUrl}/.well-known/agent-card.json`,
    about: `${AppConfig.baseUrl}/about.md`,
    contact: `${AppConfig.baseUrl}/contact.md`,
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

const apiCatalog = json({
  linkset: [
    {
      anchor: `${AppConfig.baseUrl}/api/v1`,
      item: [
        {
          href: `${AppConfig.baseUrl}/api/v1/newsletter`,
          type: 'application/json',
          title: 'Newsletter subscription API'
        },
        {
          href: `${AppConfig.baseUrl}/api/v1/report-bug`,
          type: 'application/json',
          title: 'Bug report API'
        }
      ],
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
    }
  ]
})

const agentSkillsIndex = json({
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: AGENT_SKILLS.map(skill => ({
    name: skill.name,
    type: 'skill-md',
    description: skill.description,
    tags: skill.tags,
    url: skill.url,
    digest: skill.digest
  }))
})

// Agentic Resource Discovery (ARD) v0.9 draft manifest. The draft's
// ai-catalog schema currently identifies its document format as specVersion
// "1.0". Keep entries URL-based and limited to resources served by this host;
// do not claim signatures, attestations, or decentralized identifiers that the
// deployment does not provide.
const aiCatalog = json({
  specVersion: '1.0',
  host: {
    displayName: 'THORChain Swap',
    documentationUrl: `${AppConfig.baseUrl}/developers`,
    logoUrl: `${AppConfig.baseUrl}/logo.svg`
  },
  entries: [
    {
      identifier: 'urn:air:swap.thorchain.org:mcp:server',
      displayName: 'THORChain Swap MCP server',
      type: 'application/mcp-server-card+json',
      url: `${AppConfig.baseUrl}/.well-known/mcp/server-card.json`,
      description: 'Read-only THORChain quote, liquidity-pool, and network-status tools.',
      tags: ['mcp', 'thorchain', 'swap'],
      capabilities: MCP_TOOLS.map(tool => tool.name),
      version: MCP_SERVER_INFO.version
    },
    {
      identifier: 'urn:air:swap.thorchain.org:api:openapi',
      displayName: 'THORChain Swap OpenAPI description',
      type: 'application/vnd.oai.openapi+json',
      url: `${AppConfig.baseUrl}/.well-known/openapi.json`,
      description: 'OpenAPI 3.1 description for the public support endpoints.',
      tags: ['openapi', 'rest', 'support']
    },
    {
      identifier: 'urn:air:swap.thorchain.org:api:catalog',
      displayName: 'THORChain Swap API catalog',
      type: 'application/linkset+json',
      url: `${AppConfig.baseUrl}/.well-known/api-catalog`,
      description: 'RFC 9727 catalog for the public API and its documentation.',
      tags: ['api-catalog', 'rfc9727', 'rest']
    },
    {
      identifier: 'urn:air:swap.thorchain.org:a2a:agent-card',
      displayName: 'THORChain Swap A2A agent card',
      type: 'application/a2a-agent-card+json',
      url: `${AppConfig.baseUrl}/.well-known/agent-card.json`,
      description: 'A2A discovery card for the public THORChain Swap interfaces.',
      tags: ['a2a', 'discovery', 'thorchain']
    },
    {
      identifier: 'urn:air:swap.thorchain.org:skills:index',
      displayName: 'THORChain Swap Agent Skills index',
      type: 'application/json',
      url: `${AppConfig.baseUrl}/.well-known/agent-skills/index.json`,
      description: 'Agent Skills v0.2 index for public swap, quote, pool, and network guidance.',
      tags: ['agent-skills', 'discovery', 'thorchain']
    }
  ]
})

const status = json({
  status: 'ok',
  service: 'thorchain-swap',
  url: AppConfig.baseUrl
})

// Homepage markdown variant, served when a client Accepts text/markdown on /.
export const homeMarkdown = `# THORChain Swap

THORChain Swap is the public swap interface for THORChain powered cross-chain swaps.

## Public Pages

- [Swap interface](${AppConfig.baseUrl}/)
- [About THORChain Swap](${AppConfig.baseUrl}/about)
- [Contact and support](${AppConfig.baseUrl}/contact)
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
- [MCP server card](${AppConfig.baseUrl}/.well-known/mcp/server-card.json)
- [robots.txt](${AppConfig.baseUrl}/robots.txt)
- [sitemap.xml](${AppConfig.baseUrl}/sitemap.xml)
- [API catalog](${AppConfig.baseUrl}/.well-known/api-catalog)
- [ARD AI catalog](${AppConfig.baseUrl}/.well-known/ai-catalog.json)
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
  '/index.md': { contentType: MARKDOWN, body: homeMarkdown },
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
  '/.well-known/mcp/server-card.json': { contentType: 'application/mcp-server-card+json; charset=utf-8', body: mcpServerCard },
  '/.well-known/agent-card.json': { contentType: 'application/a2a-agent-card+json; charset=utf-8', body: agentCard },
  '/.well-known/api-catalog': {
    contentType: 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"; charset=utf-8',
    body: apiCatalog
  },
  '/.well-known/agent-skills/index.json': { contentType: JSON_TYPE, body: agentSkillsIndex },
  '/.well-known/ai-catalog.json': { contentType: JSON_TYPE, body: aiCatalog },
  '/.well-known/status': { contentType: JSON_TYPE, body: status },
  ...Object.fromEntries(AGENT_SKILLS.map(skill => [skill.path, { contentType: MARKDOWN, body: skill.markdown }]))
}
