# THORChain Swap

The official web interface for native cross-chain swaps, powered by [THORChain](https://www.thorchain.org) and Maya Protocol — live at
[swap.thorchain.org](https://swap.thorchain.org).

Trade Bitcoin, Ethereum, stablecoins, and other layer-1 assets directly between chains: no bridges, no wrapped tokens, no order books, and no user
accounts. Users connect their own wallet and sign transactions locally, or swap without connecting a wallet at all via memoless ("instant") swaps.

## THORChain Developer Resources

THORChain developer resources for the swap interface — API docs, OpenAPI spec, auth docs, and MCP server:

- [Developer portal](https://swap.thorchain.org/developers) — the index (Markdown: [/developers.md](https://swap.thorchain.org/developers.md))
- [Quickstart](https://swap.thorchain.org/developers/quickstart) — first swap quote in one request, no API key
- [REST API reference](https://swap.thorchain.org/developers/api) — endpoints, error format, idempotency, versioning, sandbox
- [MCP server reference](https://swap.thorchain.org/developers/mcp) — canonical THORChain MCP endpoint, live schemas, Streamable HTTP and SSE
- [Authentication](https://swap.thorchain.org/developers/auth) — none needed here; where aggregator API keys come from
- [SDKs](https://swap.thorchain.org/developers/sdks) — [`@tcswap/sdk`](https://www.npmjs.com/package/@tcswap/sdk) for building swaps, plus Python
  ([`sdk/python`](./sdk/python)) and Go ([`sdk/go`](./sdk/go)) clients for the keyless public surfaces
- [Webhooks and event polling](https://swap.thorchain.org/developers/webhooks) — how to track swap state without webhooks
- [OpenAPI 3.1 description](https://swap.thorchain.org/.well-known/openapi.json) — the public REST API
- [THORChain MCP registry entry](https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/latest) — canonical
  `org.thorchain/thorchain-mcp` server at `https://mcp.thorchain.org/mcp`, owned by the [core MCP repo](https://gitlab.com/thorchain/thorchain-mcp)
- [Live MCP server-card mirror](https://swap.thorchain.org/.well-known/mcp/server-card.json) — core tools and capabilities with THORChain branding
- [Authentication model](https://swap.thorchain.org/auth.md) — anonymous, rate-limited public access; no key, token, or OAuth for the MCP server, and
  free aggregator API keys via the [affiliate program](https://affiliate.thorchain.org)

MCP callers use `quote_swap` (integer amount in 1e8 base units), `list_pools` (`limit`/`offset`), and `get_network_summary` as a selected subset. Call
`tools/list` for the complete live inventory. Send `Accept: application/json, text/event-stream` and parse JSON-RPC from SSE `data:` events;
successful tool payloads are under `result.structuredContent.data`. The swap site's old `/mcp` URL redirects permanently to the core endpoint and does
not translate the former swap-only contract. Python and Go helpers call core MCP directly while keeping support REST requests on this site.

## AI Agent Resources

- [llms.txt](https://swap.thorchain.org/llms.txt) — index of agent resources with when-to-use guidance
- [Agent library](https://swap.thorchain.org/llms-full.md) — complete single-file reference (URL scheme, MCP examples, asset notation, quote
  semantics, safety rules)
- [AGENTS.md](https://swap.thorchain.org/AGENTS.md) — guidance and safety rules for agents using the site
- [`AGENTS.md`](./AGENTS.md) (repo root) — instructions for AI coding agents working on this codebase

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env` and fill in the API keys. Typecheck with
`npx tsc --noEmit -p tsconfig.json`.

See [`AGENTS.md`](./AGENTS.md) for architecture notes, key paths, and conventions.
