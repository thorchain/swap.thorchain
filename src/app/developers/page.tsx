import type { Metadata } from 'next'
import Link from 'next/link'
import { AppConfig } from '@/config'
import {
  developerDiscoveryLinks,
  developerEndpoints,
  developerMcpTools,
  developerScopes,
  errorExample,
  mcpQuoteExample
} from '@/lib/agent/developer-portal'

export const metadata: Metadata = {
  title: 'THORChain Developer Resources | Swap API Docs, MCP Server & Agent Tools',
  description:
    'THORChain developer resources for the swap interface: public REST API with OpenAPI description, MCP server for AI agents, OAuth scopes, JSON error format, rate limits, and stagenet sandbox.',
  keywords: ['THORChain developer resources', 'THORChain API', 'THORChain Swap API', 'THORChain MCP server', 'cross-chain swap API'],
  alternates: {
    canonical: `${AppConfig.baseUrl}/developers`,
    types: { 'text/markdown': `${AppConfig.baseUrl}/developers.md` }
  },
  openGraph: {
    title: 'THORChain Developer Resources | Swap API Docs & MCP Server',
    description: 'THORChain developer resources: API docs, MCP server, agent tools, and sandbox for the swap interface.',
    url: `${AppConfig.baseUrl}/developers`,
    siteName: 'THORChain Swap',
    type: 'website'
  }
}

const developersJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${AppConfig.baseUrl}/developers#webpage`,
      name: 'THORChain Developer Resources',
      url: `${AppConfig.baseUrl}/developers`,
      description:
        'THORChain developer resources for the swap interface: REST API, OpenAPI description, MCP server for AI agents, authentication scopes, and sandbox.',
      isPartOf: { '@id': `${AppConfig.baseUrl}/#website` },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'THORChain Swap', item: AppConfig.baseUrl },
          { '@type': 'ListItem', position: 2, name: 'Developer Resources', item: `${AppConfig.baseUrl}/developers` }
        ]
      }
    },
    {
      '@type': 'WebAPI',
      '@id': `${AppConfig.baseUrl}/developers#webapi`,
      name: 'THORChain Swap Public API',
      url: `${AppConfig.baseUrl}/developers`,
      documentation: `${AppConfig.baseUrl}/.well-known/openapi.json`,
      termsOfService: AppConfig.tosLink,
      provider: { '@id': `${AppConfig.baseUrl}/#organization` }
    }
  ]
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10">
      <h2 className="text-txt-high-contrast text-xl font-semibold">{title}</h2>
      <div className="text-txt-med-contrast mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-sub-container-modal overflow-x-auto rounded-lg border p-4 font-mono text-xs">
      <code>{children}</code>
    </pre>
  )
}

export default function DevelopersPage() {
  return (
    <main className="bg-body min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link href="/" className="text-txt-high-contrast text-sm font-semibold">
            THORChain Swap
          </Link>
          <Link href="/" className="text-txt-med-contrast text-sm underline">
            Open the swap interface
          </Link>
        </div>
      </header>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(developersJsonLd) }} />
      <article className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-txt-high-contrast text-3xl font-bold">THORChain Developer Resources</h1>
        <p className="text-txt-med-contrast mt-4 text-sm leading-relaxed">
          THORChain developer resources for the swap interface — API docs, OpenAPI spec, auth docs, and MCP server — for
          THORChain Swap, the public web interface for native cross-chain swaps powered by THORChain and Maya Protocol.
          Everything on this page is also available as markdown at{' '}
          <a className="underline" href="/developers.md">
            /developers.md
          </a>
          .
        </p>

        <Section id="architecture" title="Architecture">
          <p>THORChain Swap consists of two components:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>UI</strong> — this web app. Users connect their own wallet and sign transactions locally, or swap
              without connecting a wallet via memoless (&ldquo;instant&rdquo;) swaps.
            </li>
            <li>
              <strong>Backend API</strong> — the THORChain/Maya Protocol swap aggregator:{' '}
              <code>https://api.thorchain.org/v1</code> for swap quotes and routes (requires an <code>x-api-key</code>{' '}
              header; keys are not self-service — contact the maintainers) and{' '}
              <code>https://api.thorchain.org/memoless/api/v1</code> for memoless (instant) swaps (no API key required).
            </li>
          </ul>
          <p>
            The UI also reads protocol metadata (pools, network parameters, THORNames, balances, inbound addresses) directly
            from public THORNode and Midgard APIs. The keyless path for agents is the MCP server below, which serves quote,
            pool, and network data from THORNode.
          </p>
        </Section>

        <Section id="quickstart" title="Quickstart">
          <p>
            No API key or registration is required. Fetch a BTC → ETH swap quote through the public MCP server:
          </p>
          <Code>{mcpQuoteExample}</Code>
          <p>
            Amounts are strings in 1e8 base units (<code>100000000</code> = 1 BTC). Pass a <code>destination</code> address to
            receive a usable transaction memo. Quotes, memos, and inbound addresses expire; always re-fetch before use.
          </p>
        </Section>

        <Section id="mcp" title="MCP Server">
          <p>
            A public, unauthenticated, rate-limited MCP server (streamable HTTP, stateless, JSON responses) is available at{' '}
            <code>{AppConfig.baseUrl}/mcp</code>. Its server card is published at{' '}
            <a className="underline" href="/.well-known/mcp-server-card">
              /.well-known/mcp-server-card
            </a>
            .
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {developerMcpTools.map(tool => (
              <li key={tool.name}>
                <code>{tool.name}</code> — {tool.summary}
              </li>
            ))}
          </ul>
          <p>
            The server supports MCP Apps (<code>io.modelcontextprotocol/ui</code>): <code>get_swap_quote</code> declares{' '}
            <code>_meta.ui.resourceUri</code> pointing at the <code>ui://thorchain-swap/swap-quote</code> resource, which
            MCP Apps-capable hosts render as an interactive quote view.
          </p>
          <p>The server never holds keys, signs, or submits transactions.</p>
        </Section>

        <Section id="api" title="REST API">
          <p>
            The public REST API is described by an OpenAPI 3.1 document at{' '}
            <a className="underline" href="/.well-known/openapi.json">
              /.well-known/openapi.json
            </a>{' '}
            (alias:{' '}
            <a className="underline" href="/openapi.json">
              /openapi.json
            </a>
            ).
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {developerEndpoints.map(endpoint => (
              <li key={endpoint.path}>
                <code>
                  {endpoint.method} {endpoint.path}
                </code>{' '}
                — {endpoint.summary} (scope: <code>{endpoint.scope}</code>)
              </li>
            ))}
          </ul>
          <p>
            <strong>Idempotency:</strong> both POST endpoints accept an <code>Idempotency-Key</code> header (any unique
            string, max 255 chars). A retry with the same key within one hour replays the original JSON response — marked
            with an <code>Idempotency-Replayed: true</code> response header — instead of re-executing the operation.{' '}
            <code>429</code> and <code>5xx</code> outcomes are not stored, so retrying after them can succeed.
          </p>
          <p>
            <strong>Versioning and deprecation:</strong> the API is versioned in the URL path — <code>/api/v1/</code> is the
            canonical prefix, and unversioned <code>/api/*</code> paths are stable aliases of the newest major version.
            Breaking changes ship as a new <code>/api/vN</code> prefix with at least six months of overlap; endpoints
            scheduled for removal signal it with <code>Deprecation</code> and <code>Sunset</code> response headers and are
            announced on this page before retirement.
          </p>
        </Section>

        <Section id="auth" title="Authentication and Scopes">
          <p>
            Browsing, quoting, and the support APIs are anonymous today; there are no accounts, and users sign transactions in
            their own wallets (or use memoless swaps with no wallet connection). The aggregator quote API (
            <code>https://api.thorchain.org/v1</code>) is the exception: it requires an <code>x-api-key</code> header. The
            OAuth 2.0 model below defines least-privilege scopes for when self-service credential issuance is enabled:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {developerScopes.map(entry => (
              <li key={entry.scope}>
                <code>{entry.scope}</code> — {entry.summary}
              </li>
            ))}
          </ul>
          <p>
            See the{' '}
            <a className="underline" href="/.well-known/oauth-authorization-server">
              OAuth authorization server metadata
            </a>{' '}
            and{' '}
            <a className="underline" href="/auth.md">
              auth.md
            </a>
            .
          </p>
        </Section>

        <Section id="errors" title="Errors">
          <p>
            Every non-2xx API response is JSON with a machine-readable <code>code</code>, a human-readable <code>error</code>,
            and a resolution <code>hint</code>:
          </p>
          <Code>{errorExample}</Code>
          <p>
            Rate limits return <code>429</code> with a <code>Retry-After</code> header (seconds). Unknown <code>/api/*</code>{' '}
            paths return a JSON <code>404</code> with code <code>not_found</code>.
          </p>
        </Section>

        <Section id="sandbox" title="Sandbox">
          <p>Test integrations against THORChain stagenet before touching mainnet funds:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Stagenet THORNode API:{' '}
              <a className="underline" href="https://stagenet-thornode.ninerealms.com" rel="noopener noreferrer" target="_blank">
                stagenet-thornode.ninerealms.com
              </a>
            </li>
            <li>
              Stagenet Midgard API:{' '}
              <a className="underline" href="https://stagenet-midgard.ninerealms.com" rel="noopener noreferrer" target="_blank">
                stagenet-midgard.ninerealms.com
              </a>
            </li>
          </ul>
        </Section>

        <Section id="protocol" title="THORChain Protocol Resources">
          <p>
            This site is an interface to the THORChain protocol. Protocol-level development (memos, inbound addresses, quote
            endpoints, node operation) is documented at:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <a className="underline" href="https://dev.thorchain.org" rel="noopener noreferrer" target="_blank">
                THORChain developer docs (dev.thorchain.org)
              </a>
            </li>
            <li>
              <a className="underline" href="https://thornode.ninerealms.com/thorchain/doc" rel="noopener noreferrer" target="_blank">
                THORNode API reference
              </a>
            </li>
            <li>
              <a className="underline" href="https://midgard.ninerealms.com/v2/doc" rel="noopener noreferrer" target="_blank">
                Midgard API reference
              </a>
            </li>
            <li>
              <a className="underline" href="https://github.com/thorchain/swap.thorchain" rel="noopener noreferrer" target="_blank">
                This interface&apos;s source code
              </a>{' '}
              (with AGENTS.md instructions for AI coding agents)
            </li>
          </ul>
        </Section>

        <Section id="discovery" title="Discovery Resources">
          <ul className="list-disc space-y-1 pl-5">
            {developerDiscoveryLinks.map(link => (
              <li key={link.path}>
                <a className="underline" href={link.path}>
                  {link.path}
                </a>{' '}
                — {link.summary}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="support" title="Support">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Email: <a className="underline" href={`mailto:${AppConfig.supportEmail}`}>{AppConfig.supportEmail}</a>
            </li>
            <li>
              <a className="underline" href={AppConfig.discordLink} rel="noopener noreferrer" target="_blank">
                THORChain community Discord
              </a>
            </li>
            <li>
              Bug reports and feature requests: <code>POST /api/report-bug</code>
            </li>
          </ul>
        </Section>
      </article>
    </main>
  )
}
