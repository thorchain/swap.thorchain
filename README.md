# THORChain Swap

The official web interface for native cross-chain swaps, powered by [THORChain](https://www.thorchain.org) and Maya Protocol — live at [swap.thorchain.org](https://swap.thorchain.org).

Trade Bitcoin, Ethereum, stablecoins, and other layer-1 assets directly between chains: no bridges, no wrapped tokens, no order books, and no user accounts. Users connect their own wallet and sign transactions locally, or swap without connecting a wallet at all via memoless ("instant") swaps.

## THORChain Developer Resources

THORChain developer resources for the swap interface — API docs, OpenAPI spec, auth docs, and MCP server:

- [Developer portal](https://swap.thorchain.org/developers) — API reference, quickstart, MCP server, auth scopes, error format, versioning policy, and sandbox (Markdown: [/developers.md](https://swap.thorchain.org/developers.md))
- [OpenAPI 3.1 description](https://swap.thorchain.org/.well-known/openapi.json) — the public REST API
- [MCP server](https://swap.thorchain.org/.well-known/mcp-server-card) — public Model Context Protocol server at `/mcp` with swap-quote, pool, and network tools (supports MCP Apps)
- [Authentication model](https://swap.thorchain.org/auth.md) — anonymous access and OAuth scopes

## AI Agent Resources

- [llms.txt](https://swap.thorchain.org/llms.txt) — index of agent resources with when-to-use guidance
- [Agent library](https://swap.thorchain.org/llms-full.md) — complete single-file reference (URL scheme, MCP examples, asset notation, quote semantics, safety rules)
- [AGENTS.md](https://swap.thorchain.org/AGENTS.md) — guidance and safety rules for agents using the site
- [`AGENTS.md`](./AGENTS.md) (repo root) — instructions for AI coding agents working on this codebase

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` to `.env` and fill in the API keys. Typecheck with `npx tsc --noEmit -p tsconfig.json`.

See [`AGENTS.md`](./AGENTS.md) for architecture notes, key paths, and conventions.
