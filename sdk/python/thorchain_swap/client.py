"""Read-only core THORChain MCP helpers and THORChain Swap support APIs."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Sequence

DEFAULT_BASE_URL = "https://swap.thorchain.org"
DEFAULT_MCP_URL = "https://mcp.thorchain.org/mcp"
DEFAULT_TIMEOUT = 20.0
MAX_SAFE_INTEGER = 9007199254740991


class _McpRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Keep an MCP POST intact across the legacy endpoint's 307/308 redirect."""

    def redirect_request(self, request, response, code, message, headers, new_url):
        if request.get_method() != "POST":
            return super().redirect_request(request, response, code, message, headers, new_url)
        if code not in (307, 308) or urllib.parse.urlsplit(new_url).scheme not in ("http", "https"):
            return None
        forwarded = {
            key: value for key, value in request.header_items()
            if key.lower() not in ("host", "authorization", "proxy-authorization", "cookie")
        }
        return urllib.request.Request(new_url, data=request.data, headers=forwarded, method="POST")


class ThorchainSwapError(Exception):
    """Raised when the API returns an error response or an error tool result."""

    def __init__(self, message: str, status: Optional[int] = None, code: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.code = code


class ThorchainSwapClient:
    """Client for the canonical core MCP server and Swap support endpoints.

    The public surfaces need no credential of any kind, so the client takes
    none.

    Args:
        base_url: Swap support API origin, e.g. for a preview deployment.
        timeout: Per-request timeout in seconds.
        mcp_url: Core MCP endpoint; independent of the Swap support origin.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        mcp_url: str = DEFAULT_MCP_URL,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.mcp_url = mcp_url
        self._mcp_opener = urllib.request.build_opener(_McpRedirectHandler())
        self._rpc_id = 0

    # --- MCP tools -------------------------------------------------------

    def get_swap_quote(
        self,
        from_asset: str,
        to_asset: str,
        amount: str,
        destination: Optional[str] = None,
        streaming_interval: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch a swap quote. Amounts are strings in 1e8 base units.

        Quotes are indicative and expire; re-fetch before showing one to a user.
        Use the core ``prepare_swap`` tool when executable deposit instructions
        are needed; the presence of quote fields is not an execution guarantee.
        """
        if not isinstance(amount, str) or not amount.isascii() or not amount.isdigit():
            raise ValueError("amount must be a positive integer string in 1e8 base units")
        numeric_amount = int(amount)
        if not 0 < numeric_amount <= MAX_SAFE_INTEGER:
            raise ValueError("amount must be between 1 and 9007199254740991 base units")
        if streaming_interval:
            raise ValueError("The core quote_swap tool does not support streaming_interval")
        arguments: Dict[str, Any] = {
            "from_asset": from_asset,
            "to_asset": to_asset,
            "amount": numeric_amount,
        }
        if destination:
            arguments["destination"] = destination
        return self._call_tool("quote_swap", arguments)

    def list_pools(
        self,
        status: Optional[str] = None,
        asset: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List core pools, filtering and limiting locally after pagination.

        The core server returns Midgard data. Status values are lowercase.
        A bare chain filter matches only that chain; CHAIN.SYMBOL is a prefix.
        """
        if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int) or limit < 1):
            raise ValueError("limit must be a positive integer")
        pools: List[Dict[str, Any]] = []
        offset = 0
        while True:
            page = self._call_tool("list_pools", {"limit": 1000, "offset": offset})
            if not isinstance(page, list):
                raise ThorchainSwapError("Core list_pools returned an invalid pool list")
            pools.extend(page)
            if len(page) < 1000:
                break
            offset += len(page)
        if status:
            pools = [pool for pool in pools if str(pool.get("status", "")).lower() == status.lower()]
        if asset:
            search = asset.upper()
            pools = [
                pool for pool in pools
                if (str(pool.get("asset", "")).upper().startswith(search) if "." in search
                    else str(pool.get("asset", "")).split(".")[0].upper() == search)
            ]
        pools.sort(key=lambda pool: int(pool.get("balance_rune") or "0"), reverse=True)
        return pools[:limit] if limit is not None else pools

    def get_network_status(self, fields: Optional[Sequence[str]] = None) -> Dict[str, Any]:
        """Return core get_network_summary data, optionally projected locally.

        This is Midgard summary data (e.g. active_node_count, bonding_apy), not
        the old THORNode /network fee object. Unknown fields are omitted.
        """
        network = self._call_tool("get_network_summary", {})
        if not isinstance(network, dict):
            raise ThorchainSwapError("Core get_network_summary returned an invalid object")
        if fields and (isinstance(fields, str) or any(not isinstance(field, str) for field in fields)):
            raise ValueError("fields must be a sequence of strings")
        return {key: network[key] for key in fields if key in network} if fields else network

    def list_tools(self) -> List[Dict[str, Any]]:
        """List the MCP tools with their JSON Schemas."""
        return self._rpc("tools/list", {})["tools"]

    # --- Support endpoints ----------------------------------------------

    def subscribe_newsletter(self, email: str, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Subscribe an email address to THORChain Swap updates."""
        return self._post_json("/api/v1/newsletter", {"email": email}, idempotency_key)

    # --- internals -------------------------------------------------------

    def _call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        result = self._rpc("tools/call", {"name": name, "arguments": arguments})
        text = next(
            (part.get("text") for part in result.get("content", []) if part.get("type") == "text"),
            None,
        )
        if result.get("isError"):
            raise ThorchainSwapError(text or f"Tool {name} failed")
        if "structuredContent" in result:
            payload = result["structuredContent"]
        else:
            payload = json.loads(text) if text else None
        if isinstance(payload, dict) and "data" in payload and "_metadata" in payload:
            return payload["data"]
        return payload

    def _rpc(self, method: str, params: Any) -> Dict[str, Any]:
        self._rpc_id += 1
        rpc_id = self._rpc_id
        payload = json.dumps(
            {"jsonrpc": "2.0", "id": rpc_id, "method": method, "params": params}
        ).encode()
        response = self._request(
            self.mcp_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "MCP-Protocol-Version": "2025-06-18",
            },
            rpc_id=rpc_id,
        )
        if not isinstance(response, dict) or response.get("id") != rpc_id:
            raise ThorchainSwapError("MCP response did not match the request")
        if "error" in response:
            error = response["error"]
            raise ThorchainSwapError(error.get("message", "MCP error"), code=str(error.get("code")))
        if "result" not in response:
            raise ThorchainSwapError("MCP response did not match the request")
        return response["result"]

    def _post_json(
        self, path: str, body: Dict[str, Any], idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return self._request(f"{self.base_url}{path}", data=json.dumps(body).encode(), headers=headers)

    def _request(
        self, url: str, data: bytes, headers: Dict[str, str], rpc_id: Optional[int] = None
    ) -> Dict[str, Any]:
        request = urllib.request.Request(url, data=data, headers=headers)
        try:
            open_request = self._mcp_opener.open if rpc_id is not None else urllib.request.urlopen
            with open_request(request, timeout=self.timeout) as response:
                if rpc_id is not None and response.headers.get_content_type() == "text/event-stream":
                    return self._read_sse(response, rpc_id)
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:  # noqa: PERF203 - one failure path
            raw = error.read().decode()
            try:
                body = json.loads(raw)
            except ValueError:
                body = {}
            detail = (body.get("error_description") or body.get("error")) if isinstance(body, dict) else None
            message = detail.get("message") if isinstance(detail, dict) else detail
            code = detail.get("code") if isinstance(detail, dict) else body.get("code") if isinstance(body, dict) else None
            raise ThorchainSwapError(message or raw or str(error), status=error.code, code=str(code) if code is not None else None) from error

    @staticmethod
    def _read_sse(response: Any, rpc_id: int) -> Dict[str, Any]:
        data: List[str] = []
        for raw_line in response:
            line = raw_line.decode("utf-8").rstrip("\r\n")
            if line.startswith("data:"):
                value = line[5:]
                data.append(value[1:] if value.startswith(" ") else value)
            elif not line and data:
                event = json.loads("\n".join(data))
                data = []
                if isinstance(event, dict) and event.get("id") == rpc_id:
                    return event
        if data:
            event = json.loads("\n".join(data))
            if isinstance(event, dict) and event.get("id") == rpc_id:
                return event
        raise ThorchainSwapError("MCP event stream ended without a matching response")
