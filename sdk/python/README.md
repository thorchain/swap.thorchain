# thorchain-swap

Python helpers for the canonical [THORChain MCP](https://gitlab.com/thorchain/thorchain-mcp) server and the
[THORChain Swap](https://swap.thorchain.org) support API.

Dependency-free (standard library only), and needs no API key, token, or sign-in. The client holds no keys and cannot submit a swap: users sign in
their own wallets, or send funds themselves through the memoless flow.

## Install

```bash
pip install "git+https://github.com/thorchain/swap.thorchain#subdirectory=sdk/python"
```

The client is currently distributed from this repository. A PyPI release has not yet been published.

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
network = client.get_network_status(fields=["active_node_count"])
```

## Core MCP migration

MCP requests go directly to `https://mcp.thorchain.org/mcp`, published as
[`org.thorchain/thorchain-mcp`](https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/latest). `base_url`
configures only the Swap support API; use `mcp_url` to override the MCP endpoint independently. The client accepts JSON and SSE responses and
preserves the POST body across 307/308 redirects if a legacy endpoint is supplied.

The Python helper names remain stable, while their core tools are:

- `get_swap_quote` calls `quote_swap`, converting the integer-string amount to a JSON integer in 1e8 base units. Amounts must be between 1 and
  9,007,199,254,740,991 so JavaScript servers can represent them exactly. The core tool does not support `streaming_interval`; passing it raises
  `ValueError`.
- `list_pools` fetches all pages of core `list_pools`, then applies status/asset filters and the depth-sorted limit locally. Core pool status is
  lowercase, and `asset_tor_price` may be empty.
- `get_network_status` calls `get_network_summary` and projects requested fields locally. **Its response is now a Midgard summary**, with keys such as
  `active_node_count`, `bonding_apy`, and `total_pooled_rune`. It does not contain the retired THORNode `/network` fee fields such as
  `native_outbound_fee_rune`. Unknown requested fields are omitted.

Core tool results carry `structuredContent.data` plus source/freshness metadata. The helpers return the `data` payload. Use `list_tools()` for the
core server's current tool schemas.

## Tests

From the repository root:

```bash
python -m unittest discover -s sdk/python -v
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
