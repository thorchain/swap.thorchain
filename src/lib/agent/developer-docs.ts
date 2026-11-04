import { AppConfig } from '@/config'
import { developerEndpoints, mcpQuoteExample, mcpResponseExample } from '@/lib/agent/developer-portal'
import { CORE_MCP, CORE_MCP_TOOLS } from '@/lib/agent/core-mcp'
import { SDK_PACKAGES } from '@/lib/agent/sdks'
import { DEVELOPER_TOPICS, type DeveloperTopic } from '@/lib/agent/developer-topics'

// Named developer resources at predictable URLs: /developers/<topic> (HTML)
// and /developers/<topic>.md (markdown twin). One markdown source per topic
// feeds both — the HTML page renders it through <MarkdownArticle>, and
// src/proxy.ts serves the same string at the .md URL.

const base = AppConfig.baseUrl

const quickstart = `# THORChain Swap API Quickstart

Fetch a live THORChain quote for a THORChain Swap (${base}) integration in one request — no account, no API key, no registration.

## 1. Call the MCP server

The canonical ${CORE_MCP.title} server at ${CORE_MCP.endpoint} speaks JSON-RPC 2.0 over HTTP POST. It requires the dual Accept header shown below and returns SSE events. No credential is required.

\`\`\`bash
${mcpQuoteExample}
\`\`\`

## 2. Read the quote

Parse the JSON-RPC object in each SSE \`data:\` event. Read the quote at \`result.structuredContent.data\`; \`result.structuredContent._metadata\` records its source and freshness. The text content contains the same data as JSON. For example (illustrative values):

\`\`\`text
${mcpResponseExample}
\`\`\`

- \`expected_amount_out\` — estimated output after fees, in 1e8 base units.
- \`fees\` — the returned protocol fees, including outbound, liquidity, and affiliate amounts. Source-chain gas is paid separately by the user's wallet.
- \`fees.slippage_bps\` — price impact in basis points.
- \`recommended_min_amount_in\` — below this, fees dominate the swap.
- \`inbound_address\` and any \`memo\` — time-sensitive transaction details, valid only until \`expiry\`. Use \`prepare_swap\` with a confirmed destination for executable deposit instructions; the user signs and sends funds.

## 3. Hand the user a prefilled swap link

\`\`\`
${base}/sell-BTC-buy-ETH
${base}/sell-BTC.BTC-buy-ETH.USDC
\`\`\`

The user completes and signs the swap themselves, in their own wallet or through the wallet-free memoless flow. THORChain Swap holds no keys and submits nothing on a user's behalf.

## Conventions

- Assets use \`CHAIN.SYMBOL\` notation: \`BTC.BTC\`, \`ETH.ETH\`, \`ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48\`.
- The core MCP \`amount\` input is an integer in 1e8 base units: \`100000000\` = 1 BTC = 1 ETH = 1 RUNE. Returned amount fields are generally strings.
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
curl -s ${base}/api/v1/newsletter \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: 5f1c1a2e-subscribe-1' \\
  -d '{"email":"you@example.com"}'
\`\`\`

## Idempotency

The POST endpoint accepts an \`Idempotency-Key\` header (any unique string, max 255 characters). A retry with the same key within one hour replays the original JSON response and marks it with \`Idempotency-Replayed: true\` instead of re-executing the operation. 429 and 5xx outcomes are not stored, so retrying after those can still succeed.

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

The hosted canonical core MCP endpoint uses mainnet. Test stagenet integrations with these dedicated APIs or a separately configured core server:

- Stagenet THORNode API: https://stagenet-thornode.ninerealms.com
- Stagenet Midgard API: https://stagenet-midgard.ninerealms.com

## Related

- [OpenAPI description](${base}/openapi.json)
- [Authentication](${base}/developers/auth)
- [Webhooks and event polling](${base}/developers/webhooks)
- [SDKs](${base}/developers/sdks)
`

const mcp = `# THORChain Swap MCP Server

Use the canonical [${CORE_MCP.title}](${CORE_MCP.documentation}) server for live THORChain data. Its official registry identity is [\`${CORE_MCP.registryName}\`](${CORE_MCP.registryUrl}).

- **Endpoint:** ${CORE_MCP.endpoint}
- **Transport:** Streamable HTTP, stateless; send JSON-RPC over POST and parse SSE responses
- **Server card:** [live core card](${CORE_MCP.serverCard}) — current version, supported protocol revisions, capabilities, and tool schemas
- **Local mirror:** [THORChain Swap server card](${base}/.well-known/mcp/server-card.json) — the live core card with THORChain branding
- **Authentication:** none — no key, token, or OAuth
- **Source and deployment ownership:** ${CORE_MCP.repository}

## Add it to a client

Claude Code:

\`\`\`bash
claude mcp add --transport http thorchain ${CORE_MCP.endpoint}
\`\`\`

VS Code:

\`\`\`bash
code --add-mcp '{"name":"thorchain","type":"http","url":"${CORE_MCP.endpoint}"}'
\`\`\`

For clients that read an \`mcpServers\` configuration:

\`\`\`json
{
  "mcpServers": {
    "thorchain": {
      "type": "http",
      "url": "${CORE_MCP.endpoint}"
    }
  }
}
\`\`\`

No credential goes in these configurations. See [authentication](${base}/developers/auth).

## Selected tools

This is a selected subset of core tools. Call \`tools/list\` at the canonical endpoint for the complete inventory and current schemas.

${CORE_MCP_TOOLS.map(tool => {
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

For executable swap instructions, use the core \`prepare_swap\` tool with \`from_asset\`, \`to_asset\`, integer \`amount\`, and a confirmed \`destination\`. It returns the deposit address, memo, minimum output, and expiry; the user still signs and sends the funds.

## Example and response

\`\`\`bash
${mcpQuoteExample}
\`\`\`

The response is \`text/event-stream\`. Parse each SSE \`data:\` event as JSON-RPC. Successful tool results contain \`structuredContent\` with \`data\` and \`_metadata\`; text content contains the same payload serialized as JSON. Example values:

\`\`\`text
${mcpResponseExample}
\`\`\`

List the complete tool inventory and JSON Schemas:

\`\`\`bash
curl -N -sS ${CORE_MCP.endpoint} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: 2025-06-18' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
\`\`\`

## Transport and migration

Use a standard Streamable HTTP MCP client. Direct callers must send both media types in \`Accept\`; JSON-only Accept is rejected. The example selects a supported legacy protocol revision; consult the live core card for current revisions. The hosted server needs no protocol session or session id. It does not offer a GET SSE subscription.

The swap site's \`/mcp\` and \`/.well-known/mcp\` URLs permanently redirect to the canonical endpoint with HTTP 308, preserving the request method and body. Server-card aliases serve a live core card for GET/HEAD and redirect JSON-RPC POST/OPTIONS requests to the core endpoint. Configure clients with the canonical endpoint directly. The official TypeScript MCP SDK defaults to same-origin redirects and rejects the cross-origin redirect unless following redirects is explicitly enabled; direct canonical configuration avoids that failure. Redirects do not translate the former swap-only tool contract:

- Former quote callers must use \`quote_swap\`, with an integer amount. The former \`streaming_interval\` parameter is not part of this schema.
- Core \`list_pools\` accepts \`limit\` and \`offset\`; it returns a pool array under \`structuredContent.data\`. The old \`asset\`/\`status\` filters are not core parameters.
- Use \`get_network_summary\` for compact network metrics. Its shape differs from the former THORNode network response; it has no \`fields\` parameter.

The local quote UI resource is not part of the core server. Only capabilities present in the live core card and initialization response should be used. The core endpoint currently has no browser CORS allowance and returns 405 to OPTIONS, so browser cross-origin fetch cannot call it. Use a native/server-side MCP client. Rate limits and protocol behavior are owned by the core deployment; this site does not add browser access or a local MCP quota through its redirects.

The server never holds keys, signs, or submits transactions.

## Related

- [Quickstart](${base}/developers/quickstart)
- [Authentication](${base}/developers/auth)
- [SDKs](${base}/developers/sdks)
- [AGENTS.md](${base}/AGENTS.md)
`

const auth = `# THORChain Swap API Authentication

How agents authenticate against THORChain Swap (${base}): they do not.

## Which credential do I need?

- **Reading quotes, pools, or network state** — nothing. Call [${CORE_MCP.endpoint}](${CORE_MCP.endpoint}) directly. No key, no token, no sign-in.
- **Building a swap flow on the aggregator, earning affiliate fees, or embedding the widget** — an \`x-api-key\` for \`https://api.thorchain.org/v1\`, issued free through the affiliate program at [${AppConfig.affiliateLink}](${AppConfig.affiliateLink}) after a short review. Different system, different backend.

## Anonymous by design

There are no user accounts on this site. Browsing and the public REST endpoints are anonymous; the canonical core MCP server is anonymous too. Support API limits are local to this site; MCP limits are owned by the core deployment. Wallet connection and transaction signing happen in the user's own wallet; memoless ("instant") swaps need no wallet at all. Nothing on this site can move funds, so nothing on it needs a credential.

## No authorization server

This site publishes **no** \`/.well-known/oauth-protected-resource\` and **no** \`/.well-known/oauth-authorization-server\`, and that is deliberate.

MCP clients treat the presence of protected-resource metadata as "this server requires OAuth". A connector that finds it will start a sign-in flow — dynamic client registration, then an authorization-code redirect — and fail, because there is no user account here to sign in to and nothing for a token to unlock. Serving no authorization metadata is what lets a client conclude the server is open and connect on the first try.

So: if a client asks for an OAuth client ID, an API key, or a bearer token for \`${CORE_MCP.endpoint}\`, leave the field blank. Adding the URL is the whole setup:

\`\`\`bash
claude mcp add --transport http thorchain ${CORE_MCP.endpoint}
\`\`\`

## Partner API keys (the affiliate program)

The swap aggregator that powers this interface — \`https://api.thorchain.org/v1\`, quotes and routing across every supported provider — is \`x-api-key\` gated. Keys are free:

1. Register at [${AppConfig.affiliateLink}](${AppConfig.affiliateLink}) with your name, email, website, and Telegram, and verify the email.
2. The account is reviewed; the API key is issued once it is approved.
3. The same dashboard configures affiliate and service fee splits per provider, generates the embeddable swap widget, and reports earnings.

Use that key with [\`@tcswap/sdk\`](${base}/developers/sdks), which takes it as the \`uSwap\` API key. The memoless API and the canonical core MCP server need no key at all.

## Related

- [MCP server](${base}/developers/mcp)
- [REST API reference](${base}/developers/api)
- [auth.md](${base}/auth.md)
`

const sdks = `# THORChain Swap SDKs

Official client libraries for THORChain Swap (${base}). Two kinds, because there are two kinds of integration:

- **Building swaps** — \`@tcswap/sdk\` on npm: quotes and routing across THORChain and Maya, wallet connection, and transaction building. It is the SDK this interface is itself built on.
- **Reading public data** — the Python and Go clients here: thin, dependency-free wrappers over the canonical core [MCP tools](${base}/developers/mcp) and this site's [support endpoints](${base}/developers/api). No credential of any kind.

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

\`@tcswap/sdk\` talks to the swap aggregator (\`https://api.thorchain.org/v1\`), which is \`x-api-key\` gated, and takes amounts as decimal strings. The Python and Go clients call the canonical core MCP endpoint for protocol data and this site for REST support endpoints. They need no key. Their quote helpers accept base-unit amount strings and convert them to the core MCP integer input. Helper method names remain stable, but pool and network payloads follow core schemas; see each SDK README for migration details. Pick the first to build a swap flow, the second to read quotes, pools, and network state.

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

- \`list_pools\` and \`get_network_summary\` on the [core MCP server](${base}/developers/mcp) — pool balances and compact network metrics. Page pools with \`limit\` and \`offset\`. For chain halt state use core \`get_inbound_addresses\` and \`get_mimir\`; get their schemas from \`tools/list\`.

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
