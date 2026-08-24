"""HTTP client for https://swap.thorchain.org — MCP tools and support endpoints."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Sequence

DEFAULT_BASE_URL = "https://swap.thorchain.org"
DEFAULT_TIMEOUT = 20.0


class ThorchainSwapError(Exception):
    """Raised when the API returns an error response or an error tool result."""

    def __init__(self, message: str, status: Optional[int] = None, code: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.code = code


class ThorchainSwapClient:
    """Client for the public THORChain Swap surfaces.

    The public surfaces need no credential of any kind, so the client takes
    none.

    Args:
        base_url: Override the base URL, e.g. for a preview deployment.
        timeout: Per-request timeout in seconds.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
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
        A quote only carries a usable ``memo`` and ``inbound_address`` when a
        ``destination`` address is supplied.
        """
        arguments: Dict[str, Any] = {
            "from_asset": from_asset,
            "to_asset": to_asset,
            "amount": amount,
        }
        if destination:
            arguments["destination"] = destination
        if streaming_interval:
            arguments["streaming_interval"] = streaming_interval
        return self._call_tool("get_swap_quote", arguments)

    def list_pools(
        self,
        status: Optional[str] = None,
        asset: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List liquidity pools with status, depths, and USD asset price."""
        arguments: Dict[str, Any] = {}
        if status:
            arguments["status"] = status
        if asset:
            arguments["asset"] = asset
        if limit is not None:
            arguments["limit"] = limit
        return self._call_tool("list_pools", arguments)

    def get_network_status(self, fields: Optional[Sequence[str]] = None) -> Dict[str, Any]:
        """Return current network parameters, optionally projected to ``fields``."""
        arguments: Dict[str, Any] = {"fields": list(fields)} if fields else {}
        return self._call_tool("get_network_status", arguments)

    def list_tools(self) -> List[Dict[str, Any]]:
        """List the MCP tools with their JSON Schemas."""
        return self._rpc("tools/list", {})["tools"]

    # --- Support endpoints ----------------------------------------------

    def subscribe_newsletter(self, email: str, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Subscribe an email address to THORChain Swap updates."""
        return self._post_json("/api/v1/newsletter", {"email": email}, idempotency_key)

    def report_bug(
        self,
        description: str,
        email: Optional[str] = None,
        report_type: Optional[str] = None,
        page: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """File a bug report or feature request."""
        body: Dict[str, Any] = {"description": description}
        if email:
            body["email"] = email
        if report_type:
            body["type"] = report_type
        if page:
            body["page"] = page
        return self._post_json("/api/v1/report-bug", body, idempotency_key)

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
            return result["structuredContent"]
        return json.loads(text) if text else None

    def _rpc(self, method: str, params: Any) -> Dict[str, Any]:
        self._rpc_id += 1
        payload = json.dumps(
            {"jsonrpc": "2.0", "id": self._rpc_id, "method": method, "params": params}
        ).encode()
        response = self._request(
            "/mcp",
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        if "error" in response:
            error = response["error"]
            raise ThorchainSwapError(error.get("message", "MCP error"), code=str(error.get("code")))
        return response["result"]

    def _post_json(
        self, path: str, body: Dict[str, Any], idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return self._request(path, data=json.dumps(body).encode(), headers=headers)

    def _request(self, path: str, data: bytes, headers: Dict[str, str]) -> Dict[str, Any]:
        request = urllib.request.Request(f"{self.base_url}{path}", data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:  # noqa: PERF203 - one failure path
            raw = error.read().decode()
            try:
                body = json.loads(raw)
            except ValueError:
                body = {}
            message = body.get("error_description") or body.get("error") or raw or str(error)
            raise ThorchainSwapError(message, status=error.code, code=body.get("code")) from error
