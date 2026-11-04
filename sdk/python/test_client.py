"""Offline compatibility tests: python -m unittest discover -s sdk/python."""

import contextlib
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from thorchain_swap import DEFAULT_BASE_URL, DEFAULT_MCP_URL, ThorchainSwapClient, ThorchainSwapError


@contextlib.contextmanager
def server_for(callback):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            status, headers, response = callback(self.path, self.headers, json.loads(body))
            payload = response.encode()
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def tool_result(payload):
    return {"structuredContent": {"data": payload, "_metadata": {"source_used": "midgard"}}}


class ClientTests(unittest.TestCase):
    def test_default_origins_are_separate(self):
        client = ThorchainSwapClient(base_url="http://preview.invalid")
        self.assertEqual(DEFAULT_BASE_URL, "https://swap.thorchain.org")
        self.assertEqual(client.mcp_url, DEFAULT_MCP_URL)

    def test_quote_uses_numeric_core_arguments_and_unwraps_data(self):
        client = ThorchainSwapClient()
        with patch.object(client, "_rpc", return_value=tool_result({"expected_amount_out": "123"})) as rpc:
            result = client.get_swap_quote("BTC.BTC", "ETH.ETH", "100000000", "0x123")
        self.assertEqual(result, {"expected_amount_out": "123"})
        rpc.assert_called_once_with("tools/call", {"name": "quote_swap", "arguments": {
            "from_asset": "BTC.BTC", "to_asset": "ETH.ETH", "amount": 100000000, "destination": "0x123"
        }})

    def test_quote_rejects_unsafe_amounts_and_unsupported_streaming(self):
        client = ThorchainSwapClient()
        for amount in ("0", "-1", "0.1", "9007199254740992", "١", ""):
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                client.get_swap_quote("BTC.BTC", "ETH.ETH", amount)
        with self.assertRaisesRegex(ValueError, "streaming_interval"):
            client.get_swap_quote("BTC.BTC", "ETH.ETH", "1", streaming_interval="1")

    def test_pools_paginate_before_local_chain_filter_and_depth_limit(self):
        client = ThorchainSwapClient()
        first = [{"asset": "BASE.ETH", "status": "available", "balance_rune": "1000"}] * 1000
        second = [
            {"asset": "ETH.USDC-0X123", "status": "available", "balance_rune": "9007199254740993"},
            {"asset": "ETH.ETH", "status": "available", "balance_rune": "9007199254740992"},
            {"asset": "ETH.USDT", "status": "staged", "balance_rune": "9999999999999999"},
        ]
        with patch.object(client, "_call_tool", side_effect=[first, second]) as call:
            pools = client.list_pools(status="Available", asset="ETH", limit=1)
        self.assertEqual([pool["asset"] for pool in pools], ["ETH.USDC-0X123"])
        self.assertEqual(call.call_args_list[1].args, ("list_pools", {"limit": 1000, "offset": 1000}))

    def test_network_summary_projection_is_local(self):
        client = ThorchainSwapClient()
        with patch.object(client, "_call_tool", return_value={"active_node_count": "100", "bonding_apy": "0.1"}) as call:
            network = client.get_network_status(["active_node_count", "missing"])
        self.assertEqual(network, {"active_node_count": "100"})
        call.assert_called_once_with("get_network_summary", {})

    def test_tool_error_and_json_text_fallback(self):
        client = ThorchainSwapClient()
        with patch.object(client, "_rpc", return_value={"content": [{"type": "text", "text": '{"value":1}'}]}):
            self.assertEqual(client._call_tool("x", {}), {"value": 1})
        with patch.object(client, "_rpc", return_value={"isError": True, "content": [{"type": "text", "text": "Unavailable"}]}):
            with self.assertRaisesRegex(ThorchainSwapError, "Unavailable"):
                client._call_tool("x", {})

    def test_text_only_core_envelopes_are_unwrapped_for_helpers(self):
        client = ThorchainSwapClient()
        network = {"data": {"active_node_count": "100"}, "_metadata": {"source_used": "midgard"}}
        pools = {"data": [{"asset": "BTC.BTC", "status": "available", "balance_rune": "42"}], "_metadata": {"source_used": "midgard"}}
        results = [{"content": [{"type": "text", "text": json.dumps(value)}]} for value in (network, pools)]
        with patch.object(client, "_rpc", side_effect=results):
            self.assertEqual(client.get_network_status(["active_node_count"]), {"active_node_count": "100"})
            self.assertEqual(client.list_pools()[0]["asset"], "BTC.BTC")

    def test_sse_transport_accepts_large_multiline_events_and_skips_notifications(self):
        def callback(path, headers, body):
            self.assertEqual(path, "/mcp")
            self.assertEqual(headers["Accept"], "application/json, text/event-stream")
            self.assertEqual(headers["MCP-Protocol-Version"], "2025-06-18")
            result = json.dumps({"jsonrpc": "2.0", "id": body["id"], "result": {"tools": [{"name": "x" * 70000}]}}, indent=2)
            event = ": ping\r\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/message\"}\r\n\r\nevent: message\r\n"
            event += "\r\n".join("data: " + line for line in result.splitlines()) + "\r\n\r\n"
            return 200, {"Content-Type": "text/event-stream; charset=utf-8"}, event

        with server_for(callback) as origin:
            tools = ThorchainSwapClient(mcp_url=origin + "/mcp").list_tools()
        self.assertEqual(len(tools[0]["name"]), 70000)

    def test_json_response_and_jsonrpc_error(self):
        for failure in (False, True):
            def callback(path, headers, body):
                response = {"jsonrpc": "2.0", "id": body["id"]}
                response.update({"error": {"code": -32602, "message": "Bad arguments"}} if failure else {"result": {"tools": []}})
                return 200, {"Content-Type": "application/json"}, json.dumps(response)
            with self.subTest(failure=failure), server_for(callback) as origin:
                client = ThorchainSwapClient(mcp_url=origin + "/mcp")
                if failure:
                    with self.assertRaises(ThorchainSwapError) as caught:
                        client.list_tools()
                    self.assertEqual(caught.exception.code, "-32602")
                else:
                    self.assertEqual(client.list_tools(), [])

    def test_method_preserving_redirects_retain_body_and_accept_header(self):
        for code in (307, 308):
            paths = []
            def callback(path, headers, body):
                paths.append(path)
                self.assertEqual(body["method"], "tools/list")
                self.assertIn("text/event-stream", headers["Accept"])
                if path == "/legacy":
                    return code, {"Location": "/core"}, ""
                return 200, {"Content-Type": "application/json"}, json.dumps({"jsonrpc": "2.0", "id": body["id"], "result": {"tools": []}})
            with self.subTest(code=code), server_for(callback) as origin:
                self.assertEqual(ThorchainSwapClient(mcp_url=origin + "/legacy").list_tools(), [])
            self.assertEqual(paths, ["/legacy", "/core"])

    def test_http_errors_preserve_status_and_jsonrpc_message(self):
        def callback(path, headers, body):
            return 429, {"Content-Type": "application/json"}, '{"error":{"code":-32000,"message":"Rate limited"}}'
        with server_for(callback) as origin:
            with self.assertRaises(ThorchainSwapError) as caught:
                ThorchainSwapClient(mcp_url=origin + "/mcp").list_tools()
        self.assertEqual((caught.exception.status, caught.exception.code, str(caught.exception)), (429, "-32000", "Rate limited"))

    def test_unmatched_sse_response_is_rejected(self):
        def callback(path, headers, body):
            return 200, {"Content-Type": "text/event-stream"}, 'data: {"jsonrpc":"2.0","id":99,"result":{}}\n\n'
        with server_for(callback) as origin:
            with self.assertRaisesRegex(ThorchainSwapError, "without a matching"):
                ThorchainSwapClient(mcp_url=origin + "/mcp").list_tools()

    def test_support_api_stays_on_its_own_origin(self):
        def callback(path, headers, body):
            self.assertEqual(path, "/api/v1/newsletter")
            self.assertEqual(body, {"email": "test@example.invalid"})
            self.assertEqual(headers["Idempotency-Key"], "local-test")
            return 200, {"Content-Type": "application/json"}, '{"ok":true}'
        with server_for(callback) as origin:
            result = ThorchainSwapClient(base_url=origin, mcp_url="https://unused.invalid").subscribe_newsletter("test@example.invalid", "local-test")
        self.assertEqual(result, {"ok": True})


if __name__ == "__main__":
    unittest.main()
