// MCP Apps quote view (spec 2026-01-26:
// https://github.com/modelcontextprotocol/ext-apps), linked from the
// get_swap_quote tool via _meta.ui.resourceUri.

export const SWAP_QUOTE_UI_URI = 'ui://thorchain-swap/swap-quote'

export const MCP_UI_RESOURCES = [
  {
    uri: SWAP_QUOTE_UI_URI,
    name: 'swap_quote_view',
    title: 'Swap Quote View',
    description: 'Renders a THORChain swap quote: expected output, fees, slippage, memo, inbound address, and expiry.',
    mimeType: 'text/html;profile=mcp-app'
  }
]

// Hand-rolled host handshake instead of the ext-apps SDK so the template
// stays a single self-contained string (no external assets; CSP stays empty).
export const SWAP_QUOTE_UI_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 16px;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #1a1a1a; background: transparent;
  }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; } }
  h2 { font-size: 15px; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 4px 8px 4px 0; vertical-align: top; }
  td:first-child { opacity: 0.65; white-space: nowrap; }
  td:last-child { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  .warn { margin-top: 12px; opacity: 0.65; font-size: 12px; }
  #status { opacity: 0.65; }
</style>
</head>
<body>
<h2>THORChain Swap Quote</h2>
<div id="status">Waiting for quote data…</div>
<table id="quote" hidden></table>
<p class="warn">Quotes are indicative and time-sensitive. The memo and inbound address expire; never reuse them after expiry.</p>
<script>
(function () {
  var FIELDS = [
    ['expected_amount_out', 'Expected out (1e8)'],
    ['recommended_min_amount_in', 'Min amount in (1e8)'],
    ['fees', 'Fees'],
    ['slippage_bps', 'Slippage (bps)'],
    ['streaming_swap_blocks', 'Streaming blocks'],
    ['total_swap_seconds', 'Est. duration (s)'],
    ['inbound_address', 'Inbound address'],
    ['memo', 'Memo'],
    ['expiry', 'Expires (unix)'],
    ['warning', 'Warning'],
    ['error', 'Error']
  ]

  function render(quote) {
    var table = document.getElementById('quote')
    table.textContent = ''
    FIELDS.forEach(function (field) {
      var value = quote[field[0]]
      if (value === undefined || value === null) return
      var row = table.insertRow()
      row.insertCell().textContent = field[1]
      row.insertCell().textContent = typeof value === 'object' ? JSON.stringify(value) : String(value)
    })
    table.hidden = false
    document.getElementById('status').hidden = true
  }

  function onToolResult(params) {
    var quote = params.structuredContent
    if (!quote) {
      var text = ((params.content || []).find(function (c) { return c.type === 'text' }) || {}).text
      try { quote = JSON.parse(text) } catch (e) { quote = null }
    }
    if (quote && typeof quote === 'object') render(quote)
    else document.getElementById('status').textContent = 'No quote data received.'
  }

  window.addEventListener('message', function (event) {
    var msg = event.data
    if (!msg || msg.jsonrpc !== '2.0') return
    if (msg.id === 1 && msg.result) {
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} }, '*')
    } else if (msg.method === 'ui/notifications/tool-result') {
      onToolResult(msg.params || {})
    }
  })

  window.parent.postMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'ui/initialize',
    params: {
      protocolVersion: '2026-01-26',
      capabilities: {},
      clientInfo: { name: 'thorchain-swap-quote-view', version: '1.0.0' }
    }
  }, '*')
})()
</script>
</body>
</html>
`

export const SWAP_QUOTE_UI_READ_RESULT = {
  contents: [
    {
      uri: SWAP_QUOTE_UI_URI,
      mimeType: 'text/html;profile=mcp-app',
      text: SWAP_QUOTE_UI_HTML,
      _meta: {
        ui: {
          csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] },
          prefersBorder: true
        }
      }
    }
  ]
}
