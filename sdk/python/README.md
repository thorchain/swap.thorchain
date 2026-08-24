# thorchain-swap

Official Python client for the public [THORChain Swap](https://swap.thorchain.org) APIs — swap quotes, liquidity pools, network status, and the support endpoints.

Dependency-free (standard library only), and needs no API key, token, or sign-in. The client holds no keys and cannot submit a swap: users sign in their own wallets, or send funds themselves through the memoless flow.

## Install

```bash
pip install thorchain-swap
```

## Use

```python
from thorchain_swap import ThorchainSwapClient

client = ThorchainSwapClient()

quote = client.get_swap_quote(
    from_asset="BTC.BTC",
    to_asset="ETH.ETH",
    amount="100000000",  # 1 BTC, in 1e8 base units
)

pools = client.list_pools(status="Available", asset="ETH", limit=10)
network = client.get_network_status(fields=["native_outbound_fee_rune"])
```

## Documentation

- Developer portal: https://swap.thorchain.org/developers
- MCP server: https://swap.thorchain.org/developers/mcp
- REST API: https://swap.thorchain.org/developers/api
- Authentication: https://swap.thorchain.org/developers/auth

## License

MIT
