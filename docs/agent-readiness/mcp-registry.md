# Canonical THORChain MCP Registry entry

THORChain Swap discovers the core MCP server under **`org.thorchain/thorchain-mcp`**. The
[official registry record](https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/latest) was verified November
4, 2026: title **THORChain MCP**, version **1.0.0**, active, published October 21, 2026.

- Canonical Streamable HTTP endpoint: `https://mcp.thorchain.org/mcp`
- Live server card: `https://mcp.thorchain.org/.well-known/mcp/server-card.json`
- Core source and deployment owner: <https://gitlab.com/thorchain/thorchain-mcp>

## This repository's responsibility

`src/lib/agent/core-mcp.ts` owns the canonical identity and URLs used throughout this site's discovery documents. Selected tool descriptors are
examples, not a copy of the full tool inventory. The live core card and `tools/list` own the current tools, protocol revisions, version, and
capabilities. The local card mirrors that live metadata and adds THORChain branding; it does not advertise the retired local quote UI resource.

`server.json` is a reference copy of the canonical published registry record. **Do not publish a separate swap-site registry entry or generate
registry credentials from this repository.** Core releases and registry publication belong to the core MCP repository and its maintainers. A version
in the reference record does not pin the live server; clients should use the core card and registry for current metadata.

The former `org.thorchain.swap/thorchain-swap` entry and the swap-only three-tool implementation are historical. Discovery on this site points to the
canonical core identity above. The current core source's publication files use `org.thorchain.mcp/thorchain-mcp`; that differs from the verified
published record. Preserve `org.thorchain/thorchain-mcp` here and resolve any future namespace/publication work with core maintainers.

## Compatibility URLs and clients

- `/mcp` and `/.well-known/mcp` permanently redirect with HTTP 308 to the canonical endpoint.
- Server-card aliases serve a live core card for GET/HEAD and redirect POST/OPTIONS to the canonical endpoint.
- New clients and Python/Go helpers call the canonical MCP URL directly. The official TypeScript MCP SDK defaults to same-origin redirects and rejects
  this cross-origin redirect unless redirect following is enabled explicitly. Site support REST calls keep the swap origin.
- Core requires `Content-Type: application/json` and `Accept: application/json, text/event-stream`; parse JSON-RPC from SSE `data:` events.
- Redirects preserve the method and body, but do not translate old tool names, string quote amounts, pool filters, or the old network payload.

See `/developers/mcp` (source: `src/lib/agent/developer-docs.ts`) and the SDK READMEs for migration details. No API key, token, or OAuth setup is
needed for the canonical hosted server. The core endpoint currently returns 405 to OPTIONS and has no browser CORS allowance, so browser cross-origin
fetch cannot call it. Native/server-side MCP clients can connect directly. Rate limits and HTTP behavior belong to the core deployment.
