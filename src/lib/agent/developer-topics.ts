// Metadata for the named developer resources at /developers/<slug>. Split from
// the document bodies (src/lib/agent/developer-docs.ts) so the developer portal
// can link to them without importing the content it is itself a source for.

export interface DeveloperTopic {
  slug: string
  title: string
  navTitle: string
  description: string
  keywords: string[]
}

export const DEVELOPER_TOPICS: DeveloperTopic[] = [
  {
    slug: 'quickstart',
    title: 'THORChain Swap API Quickstart | First Swap Quote in One Request',
    navTitle: 'Quickstart',
    description:
      'Fetch your first THORChain Swap quote in one request: MCP endpoint, asset notation, 1e8 base units, and prefilled swap links. No API key required.',
    keywords: ['THORChain Swap quickstart', 'THORChain swap quote API', 'THORChain API tutorial']
  },
  {
    slug: 'api',
    title: 'THORChain Swap REST API Reference | OpenAPI, Errors, Idempotency',
    navTitle: 'REST API reference',
    description:
      'Reference for the THORChain Swap public REST API: endpoints, OpenAPI 3.1 description, JSON error format, Idempotency-Key support, rate limits, versioning, and sandbox.',
    keywords: ['THORChain Swap API', 'THORChain REST API', 'THORChain OpenAPI', 'THORChain API reference']
  },
  {
    slug: 'mcp',
    title: 'THORChain Swap MCP Server | Model Context Protocol Tools for AI Agents',
    navTitle: 'MCP server',
    description:
      'The THORChain Swap MCP server: streamable HTTP endpoint, server card, tool parameter schemas for get_swap_quote, list_pools and get_network_status, MCP Apps support, and rate limits.',
    keywords: ['THORChain MCP server', 'THORChain Swap MCP', 'Model Context Protocol crypto', 'THORChain AI agent tools']
  },
  {
    slug: 'auth',
    title: 'THORChain Swap API Authentication | Anonymous Access and Partner API Keys',
    navTitle: 'Authentication',
    description:
      'How authentication works on THORChain Swap: the MCP server and support APIs need no key, token, or OAuth, and free aggregator API keys come from the affiliate program.',
    keywords: ['THORChain Swap authentication', 'THORChain API key', 'THORChain MCP no auth', 'agent auth']
  },
  {
    slug: 'sdks',
    title: 'THORChain Swap SDKs | TypeScript, Python and Go Clients',
    navTitle: 'SDKs',
    description:
      'Official THORChain Swap client libraries for TypeScript, Python, and Go, generated from the published OpenAPI and MCP descriptions.',
    keywords: ['THORChain SDK', 'THORChain Swap SDK', 'THORChain TypeScript client', 'THORChain Python client']
  },
  {
    slug: 'webhooks',
    title: 'THORChain Swap Webhooks and Event Polling | Tracking Swap State',
    navTitle: 'Webhooks and events',
    description:
      'THORChain Swap emits no webhooks. How to track swap and protocol state instead: THORNode transaction status, Midgard actions, inbound addresses, and MCP polling.',
    keywords: ['THORChain webhooks', 'THORChain swap status', 'THORChain transaction tracking']
  }
]
