import { AppConfig } from '@/config'
import { developerEndpoints, mcpQuoteExample } from '@/lib/agent/developer-portal'
import { MCP_TOOLS } from '@/lib/agent/mcp-tools'
import { SDK_PACKAGES } from '@/lib/agent/sdks'
import { DEVELOPER_TOPICS, type DeveloperTopic } from '@/lib/agent/developer-topics'

// Named developer resources at predictable URLs: /developers/<topic> (HTML)
// and /developers/<topic>.md (markdown twin). One markdown source per topic
// feeds both — the HTML page renders it through <MarkdownArticle>, and
// src/proxy.ts serves the same string at the .md URL.

const base = AppConfig.baseUrl

const quickstart = `# THORChain Swap API Quickstart

Fetch a live cross-chain swap quote from THORChain Swap (${base}) in one request — no account, no API key, no registration.

## 1. Call the MCP server

The public MCP server at ${base}/mcp speaks JSON-RPC 2.0 over HTTP POST. Every tool is read-only.

\`\`\`bash
${mcpQuoteExample}
\`\`\`

## 2. Read the quote

- \`expected_amount_out\` — estimated output after fees, in 1e8 base units.
- \`fees\` — itemised inbound gas, outbound, liquidity, and any affiliate fee.
- \`slippage_bps\` — price impact in basis points.
- \`recommended_min_amount_in\` — below this, fees dominate the swap.
- \`memo\` and \`inbound_address\` — only present when you pass a \`destination\` address, and only valid until \`expiry\`.

## 3. Hand the user a prefilled swap link

\`\`\`
${base}/sell-BTC-buy-ETH
${base}/sell-BTC.BTC-buy-ETH.USDC
\`\`\`

The user completes and signs the swap themselves, in their own wallet or through the wallet-free memoless flow. THORChain Swap holds no keys and submits nothing on a user's behalf.

## Conventions

- Assets use \`CHAIN.SYMBOL\` notation: \`BTC.BTC\`, \`ETH.ETH\`, \`ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48\`.
- Amounts are strings in 1e8 base units regardless of the asset's native decimals: \`"100000000"\` = 1 BTC = 1 ETH = 1 RUNE.
- Quotes are indicative and expire; re-fetch before showing one to a user.

## Next steps

- [MCP server reference](${base}/developers/mcp) — every tool and its parameters
- [REST API reference](${base}/developers/api) — the support endpoints and error format
- [Authentication](${base}/developers/auth) — why nothing here needs a credential, and where API keys come from
- [SDKs](${base}/developers/sdks) — TypeScript, Python, and Go clients
- [Developer portal](${base}/developers) — the full index
`

const api = `# THORChain Swap REST API Reference

The public REST API of THORChain Swap (${base}). Described by an OpenAPI 3.1 document at [${base}/openapi.json](${base}/openapi.json) (canonical alias: [${base}/.well-known/openapi.json](${base}/.well-known/openapi.json)), catalogued per RFC 9727 at [${base}/.well-known/api-catalog](${base}/.well-known/api-catalog).

These are the site's own support endpoints. **Swap quotes are not served here** — use the [MCP server](${base}/developers/mcp) or the aggregator backend described in the [developer portal](${base}/developers).

## Endpoints

${developerEndpoints.map(endpoint => `- \`${endpoint.method} ${endpoint.path}\` — ${endpoint.summary} (auth: \`${endpoint.authentication}\`)`).join('\n')}

## Example

\`\`\`bash
curl -s ${base}/api/v1/report-bug \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: 5f1c1a2e-report-1' \\
  -d '{"description":"Quote refresh spins forever on BTC to ETH","type":"bug","email":"you@example.com"}'
\`\`\`

## Idempotency

Both POST endpoints accept an \`Idempotency-Key\` header (any unique string, max 255 characters). A retry with the same key within one hour replays the original JSON response and marks it with \`Idempotency-Replayed: true\` instead of re-executing the operation. 429 and 5xx outcomes are not stored, so retrying after those can still succeed.

## Errors

Every non-2xx response is a JSON object with a machine-readable \`code\`, a human-readable \`error\`, a resolution \`hint\`, and a \`documentation\` link:

\`\`\`json
{
  "error": "Invalid email",
  "code": "invalid_email",
  "hint": "Provide a valid email address in the \\"email\\" field.",
  "documentation": "${base}/developers"
}
\`\`\`

Rate limits return \`429\` with a \`Retry-After\` header in seconds. Unknown \`/api/*\` paths return a JSON \`404\` with code \`not_found\`, never the HTML error page.

## Versioning and deprecation

\`/api/v1/\` is the canonical prefix; unversioned \`/api/*\` paths are stable aliases of the newest major version. Breaking changes ship as a new \`/api/vN\` prefix with at least six months of overlap. Endpoints scheduled for removal signal it with \`Deprecation\` and \`Sunset\` response headers and are announced on the developer portal first.

## Sandbox

Test against THORChain stagenet before touching mainnet funds:

- Stagenet THORNode API: https://stagenet-thornode.ninerealms.com
- Stagenet Midgard API: https://stagenet-midgard.ninerealms.com

## Related

- [OpenAPI description](${base}/openapi.json)
- [Authentication](${base}/developers/auth)
- [Webhooks and event polling](${base}/developers/webhooks)
- [SDKs](${base}/developers/sdks)
`

const mcp = `# THORChain Swap MCP Server

THORChain Swap runs a public [Model Context Protocol](https://modelcontextprotocol.io) server so AI agents can read live THORChain data natively.

- **Endpoint:** ${base}/mcp
- **Transport:** Streamable HTTP (stateless — single JSON responses, no SSE stream, no sessions)
- **Protocol versions:** 2025-06-18, 2025-03-26, 2024-11-05
- **Manifest:** [${base}/.well-known/mcp/server-card.json](${base}/.well-known/mcp/server-card.json) (also served by \`GET ${base}/mcp\`)
- **Authentication:** none — no key, no token, no OAuth

## Add it to a client

Claude Code:

\`\`\`bash
claude mcp add --transport http thorchain-swap ${base}/mcp
\`\`\`

VS Code:

\`\`\`bash
code --add-mcp '{"name":"thorchain-swap","type":"http","url":"${base}/mcp"}'
\`\`\`

Claude Desktop, Cursor, and anything else that reads an \`mcpServers\` config:

\`\`\`json
{
  "mcpServers": {
    "thorchain-swap": {
      "type": "http",
      "url": "${base}/mcp"
    }
  }
}
\`\`\`

No credential goes in any of these, and none is needed: if a connector UI asks for an OAuth client ID or an API key, leave it blank. See [authentication](${base}/developers/auth).

## Tools

${MCP_TOOLS.map(tool => {
  const schema = tool.inputSchema as unknown as {
    properties?: Record<string, { type?: string; description?: string }>
    required?: string[]
  }
  const properties = Object.entries(schema.properties ?? {})
  const parameters = properties.length
    ? properties
        .map(([name, value]) => `  - \`${name}\` (${value.type}${schema.required?.includes(name) ? ', required' : ''}) — ${value.description}`)
        .join('\n')
    : '  - no parameters'
  return `### \`${tool.name}\` — ${tool.title}\n\n${tool.description}\n\nParameters:\n\n${parameters}`
}).join('\n\n')}

Every tool is annotated \`readOnlyHint: true\`, \`destructiveHint: false\`, \`idempotentHint: true\`. The server holds no keys, signs nothing, and submits no transactions.

## Example

\`\`\`bash
${mcpQuoteExample}
\`\`\`

List the tools and their JSON Schemas:

\`\`\`bash
curl -s ${base}/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
\`\`\`

## MCP Apps

The server implements the MCP Apps extension (\`io.modelcontextprotocol/ui\`): \`get_swap_quote\` declares \`_meta.ui.resourceUri\` pointing at \`ui://thorchain-swap/swap-quote\`, a self-contained \`text/html;profile=mcp-app\` resource that MCP Apps-capable hosts render as an interactive quote panel. Hosts without MCP Apps support receive plain JSON and \`structuredContent\`.

## Transport notes

The server is stateless: no session id, no SSE stream, one JSON response per POST. A \`GET\` asking for \`text/event-stream\` returns 405; any other \`GET\` returns the server card. JSON-RPC batches are accepted for clients that negotiate a protocol revision allowing them — send an array, get an array back, with notifications answered by an empty \`202\`.

## Rate limits

60 requests per 10 minutes per client IP. Exceeding that returns JSON-RPC error \`-32000\` with HTTP 429 and a \`Retry-After\` header.

## Related

- [Quickstart](${base}/developers/quickstart)
- [Authentication](${base}/developers/auth)
- [SDKs](${base}/developers/sdks)
- [AGENTS.md](${base}/AGENTS.md)
`

const auth = `# THORChain Swap API Authentication

How agents authenticate against THORChain Swap (${base}): they do not.

## Which credential do I need?

- **Reading quotes, pools, or network state** — nothing. Call [${base}/mcp](${base}/developers/mcp) directly. No key, no token, no sign-in.
- **Building a swap flow on the aggregator, earning affiliate fees, or embedding the widget** — an \`x-api-key\` for \`https://api.thorchain.org/v1\`, issued free through the affiliate program at [${AppConfig.affiliateLink}](${AppConfig.affiliateLink}) after a short review. Different system, different backend.

## Anonymous by design

There are no user accounts on this site. Browsing, the public MCP server, and the public REST endpoints are all anonymous and rate limited per client (60 MCP requests per 10 minutes). Wallet connection and transaction signing happen in the user's own wallet; memoless ("instant") swaps need no wallet at all. Nothing on this site can move funds, so nothing on it needs a credential.

## No authorization server

This site publishes **no** \`/.well-known/oauth-protected-resource\` and **no** \`/.well-known/oauth-authorization-server\`, and that is deliberate.

MCP clients treat the presence of protected-resource metadata as "this server requires OAuth". A connector that finds it will start a sign-in flow — dynamic client registration, then an authorization-code redirect — and fail, because there is no user account here to sign in to and nothing for a token to unlock. Serving no authorization metadata is what lets a client conclude the server is open and connect on the first try.

So: if a client asks for an OAuth client ID, an API key, or a bearer token for \`${base}/mcp\`, leave the field blank. Adding the URL is the whole setup:

\`\`\`bash
claude mcp add --transport http thorchain-swap ${base}/mcp
\`\`\`

## Partner API keys (the affiliate program)

The swap aggregator that powers this interface — \`https://api.thorchain.org/v1\`, quotes and routing across every supported provider — is \`x-api-key\` gated. Keys are free:

1. Register at [${AppConfig.affiliateLink}](${AppConfig.affiliateLink}) with your name, email, website, and Telegram, and verify the email.
2. The account is reviewed; the API key is issued once it is approved.
3. The same dashboard configures affiliate and service fee splits per provider, generates the embeddable swap widget, and reports earnings.

Use that key with [\`@tcswap/sdk\`](${base}/developers/sdks), which takes it as the \`uSwap\` API key. The memoless API and this site's MCP server need no key at all.

## Related

- [MCP server](${base}/developers/mcp)
- [REST API reference](${base}/developers/api)
- [auth.md](${base}/auth.md)
`

const sdks = `# THORChain Swap SDKs

Official client libraries for THORChain Swap (${base}). Two kinds, because there are two kinds of integration:

- **Building swaps** — \`@tcswap/sdk\` on npm: quotes and routing across THORChain and Maya, wallet connection, and transaction building. It is the SDK this interface is itself built on.
- **Reading public data** — the Python and Go clients here: thin, dependency-free wrappers over the keyless surfaces this site publishes (the [MCP tools](${base}/developers/mcp) and the [support endpoints](${base}/developers/api)). No credential of any kind.

${SDK_PACKAGES.map(
  pkg => `## ${pkg.language}

- **Package:** \`${pkg.name}\` (${pkg.ecosystem})${pkg.registryUrl ? ` — [${pkg.registryUrl}](${pkg.registryUrl})` : ''}
- **Install:** \`${pkg.install}\`
- **Source:** [${pkg.source}](${pkg.source})
- **Status:** ${pkg.status}

\`\`\`${pkg.exampleLanguage}
${pkg.example}
\`\`\`
`
).join('\n')}

## Which one

\`@tcswap/sdk\` talks to the swap aggregator (\`https://api.thorchain.org/v1\`), which is \`x-api-key\` gated, and takes amounts as decimal strings. The Python and Go clients talk to this site's public MCP server and REST endpoints, need no key at all, and take amounts as strings in 1e8 base units. Pick the first to build a swap flow, the second to read quotes, pools, and network state.

None of them hold keys, sign transactions, or submit swaps on a user's behalf: the user always signs in their own wallet or sends funds themselves through the memoless flow.

## Related

- [Quickstart](${base}/developers/quickstart)
- [MCP server](${base}/developers/mcp)
- [REST API reference](${base}/developers/api)
- [Authentication](${base}/developers/auth)
`

const webhooks = `# THORChain Swap Webhooks and Event Polling

**THORChain Swap does not emit webhooks.** The site holds no accounts and no server-side user state, so there is no subscription to register a callback URL against. Swap state lives on the chains themselves, and that is where an agent should watch for it.

## Watch a swap instead

A swap started through this interface is an ordinary on-chain transaction. Track it with the public THORChain APIs:

- \`GET https://thornode.ninerealms.com/thorchain/tx/status/{txid}\` — stage-by-stage status of an inbound transaction, including observation, swap, and outbound scheduling.
- \`GET https://midgard.ninerealms.com/v2/actions?txid={txid}\` — the indexed action record with input, output, and fees.
- \`GET https://thornode.ninerealms.com/thorchain/inbound_addresses\` — current inbound addresses and chain halt state, before instructing a user to send funds.

Poll on the pace of the source chain's block time (Bitcoin minutes, Ethereum seconds) and stop when the outbound transaction is confirmed. There is no rate-limit benefit to polling faster than a block.

## Watch protocol state

- \`list_pools\` and \`get_network_status\` on the [MCP server](${base}/developers/mcp) — pool depths, prices, outbound fees, and halt-related parameters. Both are read-only and cheap; \`get_network_status\` accepts a \`fields\` array so a poller can fetch only the keys it watches.

## Status of this interface

- \`GET ${base}/.well-known/status\` — availability of the discovery surface.

If a genuine event-push product is ever added here, it will be documented on this page and in the [OpenAPI description](${base}/openapi.json) first.

## Related

- [REST API reference](${base}/developers/api)
- [MCP server](${base}/developers/mcp)
`

const MARKDOWN_BY_SLUG: Record<string, string> = {
  quickstart,
  api,
  mcp,
  auth,
  sdks,
  webhooks
}

export interface DeveloperDoc extends DeveloperTopic {
  markdown: string
}

export const DEVELOPER_DOCS: DeveloperDoc[] = DEVELOPER_TOPICS.map(topic => ({ ...topic, markdown: MARKDOWN_BY_SLUG[topic.slug] }))

export const developerDocBySlug = new Map(DEVELOPER_DOCS.map(doc => [doc.slug, doc]))
