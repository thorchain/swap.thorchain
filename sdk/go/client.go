// Package thorchainswap is the official Go client for the public THORChain
// Swap support APIs and the canonical THORChain core MCP server. No credential
// is needed for the read-only MCP helpers or support endpoints.
//
// Everything here is read-only or a support submission. The client holds no
// keys, signs nothing, and cannot submit a swap: users sign in their own
// wallets, or send funds themselves through the memoless flow.
package thorchainswap

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"mime"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// DefaultBaseURL is the production THORChain Swap origin.
const DefaultBaseURL = "https://swap.thorchain.org"

// DefaultMCPURL is the canonical org.thorchain/thorchain-mcp transport.
const DefaultMCPURL = "https://mcp.thorchain.org/mcp"

// Client talks to the public THORChain Swap surfaces.
type Client struct {
	BaseURL    string
	MCPURL     string
	HTTPClient *http.Client

	rpcID atomic.Int64
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides only the Swap support API origin.
func WithBaseURL(baseURL string) Option {
	return func(c *Client) { c.BaseURL = strings.TrimSuffix(baseURL, "/") }
}

// WithMCPURL overrides the core MCP endpoint independently of the support API.
func WithMCPURL(url string) Option {
	return func(c *Client) { c.MCPURL = url }
}

// WithHTTPClient supplies a custom *http.Client.
func WithHTTPClient(httpClient *http.Client) Option {
	return func(c *Client) { c.HTTPClient = httpClient }
}

// NewClient builds a client with sensible defaults.
func NewClient(options ...Option) *Client {
	client := &Client{
		BaseURL:    DefaultBaseURL,
		MCPURL:     DefaultMCPURL,
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
	for _, option := range options {
		option(client)
	}
	return client
}

// Error is an API or tool error.
type Error struct {
	Message string
	Status  int
	Code    string
}

func (e *Error) Error() string { return e.Message }

// SwapQuoteRequest describes a quote lookup. Amount is a string in 1e8 base
// units ("100000000" is 1 BTC), and assets use CHAIN.SYMBOL notation.
type SwapQuoteRequest struct {
	FromAsset   string
	ToAsset     string
	Amount      string
	Destination string
	// StreamingInterval is retained for source compatibility but unsupported
	// by the core quote_swap tool. A nonempty value returns an error.
	StreamingInterval string
}

// Pool is one liquidity pool entry.
type Pool struct {
	Asset         string `json:"asset"`
	Status        string `json:"status"`
	BalanceAsset  string `json:"balance_asset"`
	BalanceRune   string `json:"balance_rune"`
	AssetTorPrice string `json:"asset_tor_price"`
}

// ListPoolsRequest filters the pool listing.
type ListPoolsRequest struct {
	Status string
	Asset  string
	Limit  int
}

// GetSwapQuote fetches a swap quote. Quotes are indicative and expire, so
// re-fetch before showing one to a user. Use the core prepare_swap tool when
// executable deposit instructions are needed; a quote is not an execution guarantee.
func (c *Client) GetSwapQuote(ctx context.Context, request SwapQuoteRequest) (map[string]any, error) {
	amount, err := strconv.ParseUint(request.Amount, 10, 64)
	if err != nil || amount == 0 || amount > 9007199254740991 {
		return nil, fmt.Errorf("amount must be an integer string between 1 and 9007199254740991 base units")
	}
	if request.StreamingInterval != "" {
		return nil, fmt.Errorf("the core quote_swap tool does not support StreamingInterval")
	}
	arguments := map[string]any{
		"from_asset": request.FromAsset,
		"to_asset":   request.ToAsset,
		"amount":     amount,
	}
	if request.Destination != "" {
		arguments["destination"] = request.Destination
	}

	var quote map[string]any
	if err := c.callTool(ctx, "quote_swap", arguments, &quote); err != nil {
		return nil, err
	}
	return quote, nil
}

// ListPools fetches core Midgard pools, then filters and sorts locally by RUNE
// depth. Status values are lowercase. AssetTorPrice may be empty upstream.
func (c *Client) ListPools(ctx context.Context, request ListPoolsRequest) ([]Pool, error) {
	if request.Limit < 0 {
		return nil, fmt.Errorf("Limit must not be negative")
	}
	pools := []Pool{}
	for offset := 0; ; {
		var page []Pool
		if err := c.callTool(ctx, "list_pools", map[string]any{"limit": 1000, "offset": offset}, &page); err != nil {
			return nil, err
		}
		for _, pool := range page {
			if request.Status != "" && !strings.EqualFold(request.Status, pool.Status) {
				continue
			}
			if request.Asset != "" {
				asset, search := strings.ToUpper(pool.Asset), strings.ToUpper(request.Asset)
				if strings.Contains(search, ".") {
					if !strings.HasPrefix(asset, search) {
						continue
					}
				} else if strings.SplitN(asset, ".", 2)[0] != search {
					continue
				}
			}
			pools = append(pools, pool)
		}
		if len(page) < 1000 {
			break
		}
		offset += len(page)
	}
	sort.SliceStable(pools, func(i, j int) bool {
		left, right := new(big.Int), new(big.Int)
		left.SetString(pools[i].BalanceRune, 10)
		right.SetString(pools[j].BalanceRune, 10)
		return left.Cmp(right) > 0
	})
	if request.Limit > 0 && len(pools) > request.Limit {
		pools = pools[:request.Limit]
	}
	return pools, nil
}

// GetNetworkStatus returns get_network_summary Midgard data, optionally
// projected locally. Keys include active_node_count and bonding_apy. This is
// not the retired THORNode /network fee response; unknown fields are omitted.
func (c *Client) GetNetworkStatus(ctx context.Context, fields ...string) (map[string]any, error) {
	var network map[string]any
	if err := c.callTool(ctx, "get_network_summary", map[string]any{}, &network); err != nil {
		return nil, err
	}
	if len(fields) > 0 {
		selected := map[string]any{}
		for _, field := range fields {
			if value, ok := network[field]; ok {
				selected[field] = value
			}
		}
		return selected, nil
	}
	return network, nil
}

// ListTools returns the canonical server's current tool definitions.
func (c *Client) ListTools(ctx context.Context) ([]map[string]any, error) {
	var result struct {
		Tools []map[string]any `json:"tools"`
	}
	if err := c.rpc(ctx, "tools/list", map[string]any{}, &result); err != nil {
		return nil, err
	}
	return result.Tools, nil
}

// SubscribeNewsletter subscribes an email address to THORChain Swap updates.
func (c *Client) SubscribeNewsletter(ctx context.Context, email, idempotencyKey string) error {
	return c.postJSON(ctx, "/api/v1/newsletter", map[string]any{"email": email}, idempotencyKey, nil)
}

func (c *Client) callTool(ctx context.Context, name string, arguments map[string]any, out any) error {
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StructuredContent json.RawMessage `json:"structuredContent"`
		IsError           bool            `json:"isError"`
	}

	if err := c.rpc(ctx, "tools/call", map[string]any{"name": name, "arguments": arguments}, &result); err != nil {
		return err
	}

	text := ""
	for _, part := range result.Content {
		if part.Type == "text" {
			text = part.Text
			break
		}
	}
	if result.IsError {
		return &Error{Message: text}
	}
	if len(result.StructuredContent) > 0 {
		return decodeToolData(result.StructuredContent, out)
	}
	return decodeToolData([]byte(text), out)
}

func decodeToolData(raw json.RawMessage, out any) error {
	var wrapped struct {
		Data     json.RawMessage `json:"data"`
		Metadata json.RawMessage `json:"_metadata"`
	}
	if json.Unmarshal(raw, &wrapped) == nil && len(wrapped.Data) > 0 && len(wrapped.Metadata) > 0 {
		return json.Unmarshal(wrapped.Data, out)
	}
	return json.Unmarshal(raw, out)
}

func (c *Client) rpc(ctx context.Context, method string, params any, out any) error {
	id := c.rpcID.Add(1)
	payload, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
		"params":  params,
	})
	if err != nil {
		return err
	}

	var envelope struct {
		ID     *int64          `json:"id"`
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := c.do(ctx, c.MCPURL, payload, "", id, &envelope); err != nil {
		return err
	}
	if envelope.Error != nil {
		return &Error{Message: envelope.Error.Message, Code: fmt.Sprint(envelope.Error.Code)}
	}
	if envelope.ID == nil || *envelope.ID != id || len(envelope.Result) == 0 {
		return &Error{Message: "MCP response did not match the request"}
	}
	return json.Unmarshal(envelope.Result, out)
}

func (c *Client) postJSON(ctx context.Context, path string, body any, idempotencyKey string, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.do(ctx, c.BaseURL+path, payload, idempotencyKey, 0, out)
}

func (c *Client) do(ctx context.Context, url string, payload []byte, idempotencyKey string, rpcID int64, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if rpcID != 0 {
		request.Header.Set("Accept", "application/json, text/event-stream")
		request.Header.Set("MCP-Protocol-Version", "2025-06-18")
	}
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := c.HTTPClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
		var apiError struct {
			Error            json.RawMessage `json:"error"`
			ErrorDescription string          `json:"error_description"`
			Code             string          `json:"code"`
		}
		_ = json.Unmarshal(raw, &apiError)
		message := apiError.ErrorDescription
		if message == "" {
			var detail struct {
				Message string          `json:"message"`
				Code    json.RawMessage `json:"code"`
			}
			if json.Unmarshal(apiError.Error, &detail) == nil {
				message = detail.Message
				apiError.Code = strings.Trim(string(detail.Code), "\"")
			} else {
				_ = json.Unmarshal(apiError.Error, &message)
			}
		}
		if message == "" {
			message = strings.TrimSpace(string(raw))
		}
		if message == "" {
			message = fmt.Sprintf("%s responded with HTTP %d", url, response.StatusCode)
		}
		return &Error{Message: message, Status: response.StatusCode, Code: apiError.Code}
	}

	if out == nil {
		return nil
	}
	contentType, _, _ := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if rpcID != 0 && contentType == "text/event-stream" {
		raw, err := readSSE(response.Body, rpcID)
		if err != nil {
			return err
		}
		return json.Unmarshal(raw, out)
	}
	return json.NewDecoder(response.Body).Decode(out)
}

func readSSE(reader io.Reader, rpcID int64) ([]byte, error) {
	scanner := bufio.NewScanner(reader)
	// tools/list is a single event and can exceed Scanner's 64KiB default.
	scanner.Buffer(make([]byte, 4096), 16<<20)
	data := []string{}
	decode := func() ([]byte, bool) {
		raw := []byte(strings.Join(data, "\n"))
		data = nil
		var event struct {
			ID *int64 `json:"id"`
		}
		if json.Unmarshal(raw, &event) == nil && event.ID != nil && *event.ID == rpcID {
			return raw, true
		}
		return nil, false
	}
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data:") {
			data = append(data, strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
		} else if line == "" && len(data) > 0 {
			if raw, ok := decode(); ok {
				return raw, nil
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if len(data) > 0 {
		if raw, ok := decode(); ok {
			return raw, nil
		}
	}
	return nil, &Error{Message: "MCP event stream ended without a matching response"}
}
