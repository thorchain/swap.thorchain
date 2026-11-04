"""Python helpers for core THORChain MCP and Swap support APIs.

Everything exposed here is read-only or a support submission: the client holds
no keys, signs nothing, and cannot submit a swap. Users sign in their own
wallets, or send funds themselves through the memoless flow.
"""

from .client import (
    DEFAULT_BASE_URL,
    DEFAULT_MCP_URL,
    ThorchainSwapClient,
    ThorchainSwapError,
)

__all__ = ["DEFAULT_BASE_URL", "DEFAULT_MCP_URL", "ThorchainSwapClient", "ThorchainSwapError"]
__version__ = "0.3.0"
