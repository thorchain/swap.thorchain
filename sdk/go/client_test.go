package thorchainswap

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func decodeRequest(t *testing.T, r *http.Request) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return body
}

func writeResult(t *testing.T, w http.ResponseWriter, request map[string]any, result any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": request["id"], "result": result}); err != nil {
		t.Fatal(err)
	}
}

func wrapped(data any) any {
	return map[string]any{"structuredContent": map[string]any{"data": data, "_metadata": map[string]any{"source_used": "midgard"}}}
}

func TestDefaultOriginsAreSeparate(t *testing.T) {
	client := NewClient(WithBaseURL("http://preview.invalid/"))
	if client.MCPURL != "https://mcp.thorchain.org/mcp" || client.BaseURL != "http://preview.invalid" {
		t.Fatalf("unexpected origins: %+v", client)
	}
}

func TestHelpersMapToCoreAndUnwrapData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := decodeRequest(t, r)
		params := request["params"].(map[string]any)
		args := params["arguments"].(map[string]any)
		switch params["name"] {
		case "quote_swap":
			want := map[string]any{"from_asset": "BTC.BTC", "to_asset": "ETH.ETH", "amount": float64(100000000), "destination": "0x123"}
			if !reflect.DeepEqual(args, want) {
				t.Errorf("quote arguments = %#v", args)
			}
			writeResult(t, w, request, wrapped(map[string]any{"expected_amount_out": "123"}))
		case "get_network_summary":
			if len(args) != 0 {
				t.Errorf("network projection must not be sent to core: %#v", args)
			}
			writeResult(t, w, request, wrapped(map[string]any{"active_node_count": "100", "bonding_apy": "0.1"}))
		default:
			t.Errorf("unexpected core tool: %v", params["name"])
		}
	}))
	defer server.Close()
	client := NewClient(WithMCPURL(server.URL))
	quote, err := client.GetSwapQuote(context.Background(), SwapQuoteRequest{FromAsset: "BTC.BTC", ToAsset: "ETH.ETH", Amount: "100000000", Destination: "0x123"})
	if err != nil || quote["expected_amount_out"] != "123" {
		t.Fatalf("quote = %#v, err = %v", quote, err)
	}
	network, err := client.GetNetworkStatus(context.Background(), "active_node_count", "missing")
	if err != nil || !reflect.DeepEqual(network, map[string]any{"active_node_count": "100"}) {
		t.Fatalf("network = %#v, err = %v", network, err)
	}
}

func TestQuoteRejectsUnsafeAmountsAndUnsupportedStreaming(t *testing.T) {
	client := NewClient(WithMCPURL("http://unused.invalid"))
	for _, amount := range []string{"0", "-1", "0.1", "9007199254740992", "١", ""} {
		if _, err := client.GetSwapQuote(context.Background(), SwapQuoteRequest{Amount: amount}); err == nil {
			t.Errorf("accepted amount %q", amount)
		}
	}
	if _, err := client.GetSwapQuote(context.Background(), SwapQuoteRequest{Amount: "1", StreamingInterval: "1"}); err == nil || !strings.Contains(err.Error(), "StreamingInterval") {
		t.Fatalf("streaming error = %v", err)
	}
}

func TestPoolsPaginateBeforeLocalFilterAndDepthLimit(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := decodeRequest(t, r)
		params := request["params"].(map[string]any)
		args := params["arguments"].(map[string]any)
		if params["name"] != "list_pools" || len(args) != 2 || args["limit"] != float64(1000) {
			t.Errorf("unexpected pool call: %#v", params)
		}
		requests++
		if args["offset"] == float64(0) {
			pools := make([]Pool, 1000)
			for i := range pools {
				pools[i] = Pool{Asset: "BASE.ETH", Status: "available", BalanceRune: "1000"}
			}
			writeResult(t, w, request, wrapped(pools))
			return
		}
		if args["offset"] != float64(1000) {
			t.Errorf("unexpected offset %v", args["offset"])
		}
		writeResult(t, w, request, wrapped([]Pool{
			{Asset: "ETH.ETH", Status: "available", BalanceRune: "9007199254740992"},
			{Asset: "ETH.USDC-0X123", Status: "available", BalanceRune: "9007199254740993"},
			{Asset: "ETH.USDT", Status: "staged", BalanceRune: "9999999999999999"},
		}))
	}))
	defer server.Close()
	pools, err := NewClient(WithMCPURL(server.URL)).ListPools(context.Background(), ListPoolsRequest{Status: "Available", Asset: "ETH", Limit: 1})
	if err != nil || len(pools) != 1 || pools[0].Asset != "ETH.USDC-0X123" || requests != 2 {
		t.Fatalf("pools = %#v, requests = %d, err = %v", pools, requests, err)
	}
}

func TestSSETransportSkipsNotificationsAndAcceptsLargeEvents(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := decodeRequest(t, r)
		if r.Header.Get("Accept") != "application/json, text/event-stream" || r.Header.Get("MCP-Protocol-Version") != "2025-06-18" {
			t.Errorf("incorrect MCP headers: %#v", r.Header)
		}
		result, err := json.MarshalIndent(map[string]any{"jsonrpc": "2.0", "id": request["id"], "result": map[string]any{"tools": []any{map[string]any{"name": strings.Repeat("x", 70000)}}}}, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		fmt.Fprint(w, ": ping\r\ndata: {\"jsonrpc\":\"2.0\",\"method\":\"notifications/message\"}\r\n\r\nevent: message\r\n")
		for _, line := range strings.Split(string(result), "\n") {
			fmt.Fprintf(w, "data: %s\r\n", line)
		}
		fmt.Fprint(w, "\r\n")
	}))
	defer server.Close()
	tools, err := NewClient(WithMCPURL(server.URL)).ListTools(context.Background())
	if err != nil || len(tools) != 1 || len(tools[0]["name"].(string)) != 70000 {
		t.Fatalf("tools count = %d, err = %v", len(tools), err)
	}
}

func TestMethodPreservingRedirectsKeepPostBodyAndHeaders(t *testing.T) {
	for _, code := range []int{307, 308} {
		t.Run(fmt.Sprint(code), func(t *testing.T) {
			paths := []string{}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost || !strings.Contains(r.Header.Get("Accept"), "text/event-stream") {
					t.Errorf("redirect changed request: method=%s headers=%#v", r.Method, r.Header)
				}
				request := decodeRequest(t, r)
				if request["method"] != "tools/list" {
					t.Errorf("body lost in redirect: %#v", request)
				}
				paths = append(paths, r.URL.Path)
				if r.URL.Path == "/legacy" {
					w.Header().Set("Location", "/core")
					w.WriteHeader(code)
					return
				}
				writeResult(t, w, request, map[string]any{"tools": []any{}})
			}))
			defer server.Close()
			tools, err := NewClient(WithMCPURL(server.URL + "/legacy")).ListTools(context.Background())
			if err != nil || len(tools) != 0 || !reflect.DeepEqual(paths, []string{"/legacy", "/core"}) {
				t.Fatalf("paths=%#v tools=%#v err=%v", paths, tools, err)
			}
		})
	}
}

func TestJSONRPCAndHTTPFailures(t *testing.T) {
	for _, test := range []struct {
		name, contentType, body, message, code string
		status                                 int
	}{
		{"rpc", "application/json", `{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"Bad arguments"}}`, "Bad arguments", "-32602", 200},
		{"http-jsonrpc", "application/json", `{"error":{"code":-32000,"message":"Rate limited"}}`, "Rate limited", "-32000", 429},
		{"http-support", "application/json", `{"error":"Invalid email","code":"invalid_email"}`, "Invalid email", "invalid_email", 400},
		{"http-text", "text/plain", "Temporarily unavailable", "Temporarily unavailable", "", 503},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", test.contentType)
				w.WriteHeader(test.status)
				fmt.Fprint(w, test.body)
			}))
			defer server.Close()
			_, err := NewClient(WithMCPURL(server.URL)).ListTools(context.Background())
			var failure *Error
			if !errors.As(err, &failure) || failure.Message != test.message || failure.Code != test.code {
				t.Fatalf("error = %#v", err)
			}
			if test.status != 200 && failure.Status != test.status {
				t.Fatalf("HTTP status lost: %#v", failure)
			}
		})
	}
}

func TestUnmatchedSSEAndJSONResponsesAreRejected(t *testing.T) {
	for _, contentType := range []string{"application/json", "text/event-stream"} {
		t.Run(contentType, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", contentType)
				body := `{"jsonrpc":"2.0","id":99,"result":{}}`
				if contentType == "text/event-stream" {
					body = "data: " + body + "\n\n"
				}
				fmt.Fprint(w, body)
			}))
			defer server.Close()
			if _, err := NewClient(WithMCPURL(server.URL)).ListTools(context.Background()); err == nil {
				t.Fatal("accepted a mismatched response")
			}
		})
	}
}

func TestToolErrorAndJSONTextFallback(t *testing.T) {
	for _, failure := range []bool{false, true} {
		t.Run(fmt.Sprint(failure), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				text := `{"active_node_count":"100"}`
				if failure {
					text = "Unavailable"
				}
				writeResult(t, w, decodeRequest(t, r), map[string]any{"isError": failure, "content": []any{map[string]any{"type": "text", "text": text}}})
			}))
			defer server.Close()
			network, err := NewClient(WithMCPURL(server.URL)).GetNetworkStatus(context.Background())
			if failure {
				if err == nil || err.Error() != "Unavailable" {
					t.Fatalf("error = %v", err)
				}
			} else if err != nil || network["active_node_count"] != "100" {
				t.Fatalf("network = %#v, err = %v", network, err)
			}
		})
	}
}

func TestTextOnlyCoreEnvelopesAreUnwrappedForHelpers(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := decodeRequest(t, r)
		name := request["params"].(map[string]any)["name"]
		var data any = map[string]any{"active_node_count": "100"}
		if name == "list_pools" {
			data = []Pool{{Asset: "BTC.BTC", Status: "available", BalanceRune: "42"}}
		}
		payload, err := json.Marshal(map[string]any{"data": data, "_metadata": map[string]any{"source_used": "midgard"}})
		if err != nil {
			t.Fatal(err)
		}
		writeResult(t, w, request, map[string]any{"content": []any{map[string]any{"type": "text", "text": string(payload)}}})
	}))
	defer server.Close()
	client := NewClient(WithMCPURL(server.URL))
	network, err := client.GetNetworkStatus(context.Background(), "active_node_count")
	if err != nil || network["active_node_count"] != "100" {
		t.Fatalf("network = %#v, err = %v", network, err)
	}
	pools, err := client.ListPools(context.Background(), ListPoolsRequest{})
	if err != nil || len(pools) != 1 || pools[0].Asset != "BTC.BTC" {
		t.Fatalf("pools = %#v, err = %v", pools, err)
	}
}

func TestSupportAPIKeepsItsOwnOrigin(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := decodeRequest(t, r)
		if r.URL.Path != "/api/v1/newsletter" || r.Header.Get("Idempotency-Key") != "local-test" || body["email"] != "test@example.invalid" {
			t.Errorf("incorrect support request: %s %#v %#v", r.URL.Path, r.Header, body)
		}
		fmt.Fprint(w, `{"ok":true}`)
	}))
	defer server.Close()
	err := NewClient(WithBaseURL(server.URL), WithMCPURL("http://unused.invalid")).SubscribeNewsletter(context.Background(), "test@example.invalid", "local-test")
	if err != nil {
		t.Fatal(err)
	}
}
