# THORChain Swap Go SDK

Go helpers for the canonical [THORChain MCP](https://gitlab.com/thorchain/thorchain-mcp) server and the [THORChain Swap](https://swap.thorchain.org)
support API.

Standard library only, and needs no API key, token, or sign-in. The client holds no keys and cannot submit a swap: users sign in their own wallets, or
send funds themselves through the memoless flow.

## Install

```bash
go get github.com/thorchain/swap.thorchain/sdk/go
```

## Use

```go
client := thorchainswap.NewClient()

quote, err := client.GetSwapQuote(ctx, thorchainswap.SwapQuoteRequest{
	FromAsset: "BTC.BTC",
	ToAsset:   "ETH.ETH",
	Amount:    "100000000", // 1 BTC, in 1e8 base units
})

pools, err := client.ListPools(ctx, thorchainswap.ListPoolsRequest{Status: "Available", Limit: 10})
network, err := client.GetNetworkStatus(ctx, "active_node_count")
```

## Core MCP migration

MCP requests go directly to `https://mcp.thorchain.org/mcp`, published as
[`org.thorchain/thorchain-mcp`](https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/latest). `WithBaseURL`
configures only the Swap support API; use `WithMCPURL` to override the MCP endpoint independently. The default HTTP client accepts JSON and SSE and
preserves the POST body across 307/308 redirects if a legacy endpoint is supplied. A custom `HTTPClient` must retain that redirect behavior.

The Go helper names remain stable, while their core tools are:

- `GetSwapQuote` calls `quote_swap`, converting `Amount` to a JSON integer in 1e8 base units. Amounts must be between 1 and 9,007,199,254,740,991 so
  JavaScript servers can represent them exactly. The core tool does not support `StreamingInterval`; a nonempty value returns an error.
- `ListPools` fetches all pages of core `list_pools`, then applies status/asset filters and the depth-sorted limit locally. Core pool status is
  lowercase, and `AssetTorPrice` may be empty.
- `GetNetworkStatus` calls `get_network_summary` and projects requested fields locally. **Its response is now a Midgard summary**, with keys such as
  `active_node_count`, `bonding_apy`, and `total_pooled_rune`. It does not contain the retired THORNode `/network` fee fields such as
  `native_outbound_fee_rune`. Unknown requested fields are omitted.

Core tool results carry `structuredContent.data` plus source/freshness metadata. The helpers return the `data` payload. Use `ListTools` for the core
server's current tool schemas.

## Tests

```bash
cd sdk/go
go test ./...
```

The tests use local stub servers, including method-preserving redirects, SSE/JSON responses, errors, and helper mappings. They submit nothing to
production.

## Documentation

- Developer portal: https://swap.thorchain.org/developers
- MCP server: https://swap.thorchain.org/developers/mcp
- REST API: https://swap.thorchain.org/developers/api
- Authentication: https://swap.thorchain.org/developers/auth

## License

MIT
