"""Official Python client for the public THORChain Swap APIs.

Everything exposed here is read-only or a support submission: the client holds
no keys, signs nothing, and cannot submit a swap. Users sign in their own
wallets, or send funds themselves through the memoless flow.
"""

from .client import (
    DEFAULT_BASE_URL,
    ThorchainSwapClient,
    ThorchainSwapError,
)

__all__ = ["DEFAULT_BASE_URL", "ThorchainSwapClient", "ThorchainSwapError"]
__version__ = "0.1.0"
