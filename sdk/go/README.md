# THORChain Swap Go SDK

Official Go client for the public [THORChain Swap](https://swap.thorchain.org) APIs — swap quotes, liquidity pools, network status, and the support endpoints.

Standard library only, and needs no API key, token, or sign-in. The client holds no keys and cannot submit a swap: users sign in their own wallets, or send funds themselves through the memoless flow.

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
network, err := client.GetNetworkStatus(ctx, "native_outbound_fee_rune")
```

## Documentation

- Developer portal: https://swap.thorchain.org/developers
- MCP server: https://swap.thorchain.org/developers/mcp
- REST API: https://swap.thorchain.org/developers/api
- Authentication: https://swap.thorchain.org/developers/auth

## License

MIT
