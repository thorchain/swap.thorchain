// Package thorchainswap is the official Go client for the public THORChain
// Swap APIs (https://swap.thorchain.org): swap quotes, liquidity pools,
// network status, and the support endpoints. None of them need a credential.
//
// Everything here is read-only or a support submission. The client holds no
// keys, signs nothing, and cannot submit a swap: users sign in their own
// wallets, or send funds themselves through the memoless flow.
package thorchainswap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

// DefaultBaseURL is the production THORChain Swap origin.
const DefaultBaseURL = "https://swap.thorchain.org"

// Client talks to the public THORChain Swap surfaces.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client

	rpcID atomic.Int64
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides the base URL, e.g. for a preview deployment.
func WithBaseURL(baseURL string) Option {
	return func(c *Client) { c.BaseURL = strings.TrimSuffix(baseURL, "/") }
}

// WithHTTPClient supplies a custom *http.Client.
func WithHTTPClient(httpClient *http.Client) Option {
	return func(c *Client) { c.HTTPClient = httpClient }
}

// NewClient builds a client with sensible defaults.
func NewClient(options ...Option) *Client {
	client := &Client{
		BaseURL:    DefaultBaseURL,
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
	FromAsset         string
	ToAsset           string
	Amount            string
	Destination       string
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
// re-fetch before showing one to a user.
func (c *Client) GetSwapQuote(ctx context.Context, request SwapQuoteRequest) (map[string]any, error) {
	arguments := map[string]any{
		"from_asset": request.FromAsset,
		"to_asset":   request.ToAsset,
		"amount":     request.Amount,
	}
	if request.Destination != "" {
		arguments["destination"] = request.Destination
	}
	if request.StreamingInterval != "" {
		arguments["streaming_interval"] = request.StreamingInterval
	}

	var quote map[string]any
	if err := c.callTool(ctx, "get_swap_quote", arguments, &quote); err != nil {
		return nil, err
	}
	return quote, nil
}

// ListPools lists liquidity pools with status, depths, and USD asset price.
func (c *Client) ListPools(ctx context.Context, request ListPoolsRequest) ([]Pool, error) {
	arguments := map[string]any{}
	if request.Status != "" {
		arguments["status"] = request.Status
	}
	if request.Asset != "" {
		arguments["asset"] = request.Asset
	}
	if request.Limit > 0 {
		arguments["limit"] = request.Limit
	}

	var pools []Pool
	if err := c.callTool(ctx, "list_pools", arguments, &pools); err != nil {
		return nil, err
	}
	return pools, nil
}

// GetNetworkStatus returns current network parameters, optionally projected to
// the given top-level fields.
func (c *Client) GetNetworkStatus(ctx context.Context, fields ...string) (map[string]any, error) {
	arguments := map[string]any{}
	if len(fields) > 0 {
		arguments["fields"] = fields
	}

	var network map[string]any
	if err := c.callTool(ctx, "get_network_status", arguments, &network); err != nil {
		return nil, err
	}
	return network, nil
}

// SubscribeNewsletter subscribes an email address to THORChain Swap updates.
func (c *Client) SubscribeNewsletter(ctx context.Context, email, idempotencyKey string) error {
	return c.postJSON(ctx, "/api/v1/newsletter", map[string]any{"email": email}, idempotencyKey, nil)
}

// ReportBug files a bug report or feature request.
func (c *Client) ReportBug(ctx context.Context, description, email, reportType, idempotencyKey string) error {
	body := map[string]any{"description": description}
	if email != "" {
		body["email"] = email
	}
	if reportType != "" {
		body["type"] = reportType
	}
	return c.postJSON(ctx, "/api/v1/report-bug", body, idempotencyKey, nil)
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
		return json.Unmarshal(result.StructuredContent, out)
	}
	return json.Unmarshal([]byte(text), out)
}

func (c *Client) rpc(ctx context.Context, method string, params any, out any) error {
	payload, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      c.rpcID.Add(1),
		"method":  method,
		"params":  params,
	})
	if err != nil {
		return err
	}

	var envelope struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := c.do(ctx, "/mcp", payload, "application/json", "", &envelope); err != nil {
		return err
	}
	if envelope.Error != nil {
		return &Error{Message: envelope.Error.Message, Code: fmt.Sprint(envelope.Error.Code)}
	}
	return json.Unmarshal(envelope.Result, out)
}

func (c *Client) postJSON(ctx context.Context, path string, body any, idempotencyKey string, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.do(ctx, path, payload, "application/json", idempotencyKey, out)
}

func (c *Client) do(ctx context.Context, path string, payload []byte, contentType, idempotencyKey string, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("Accept", "application/json")
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := c.HTTPClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		var apiError struct {
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
			Code             string `json:"code"`
		}
		_ = json.NewDecoder(response.Body).Decode(&apiError)
		message := apiError.ErrorDescription
		if message == "" {
			message = apiError.Error
		}
		if message == "" {
			message = fmt.Sprintf("%s responded with HTTP %d", path, response.StatusCode)
		}
		return &Error{Message: message, Status: response.StatusCode, Code: apiError.Code}
	}

	if out == nil {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(out)
}
