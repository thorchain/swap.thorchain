import { AppConfig } from '@/config'
import { developersMarkdown } from '@/lib/agent/developer-portal'
import { homeMarkdown } from '@/lib/agent/discovery-files'

// Markdown twins for HTML pages: appending .md to any content page URL returns
// the markdown representation of that page (/ -> /index.md, /developers ->
// /developers.md, /sell-btc-buy-eth -> /sell-btc-buy-eth.md). Resolved by
// src/proxy.ts after the static discovery-file registry.

const SELL_PREFIX = 'sell-'
const BUY_SEPARATOR = '-buy-'

// Mirrors PAIR_PATTERN in src/app/[pair]/page.tsx: sell-<asset>-buy-<asset>.
function parsePair(slug: string) {
  if (!slug.startsWith(SELL_PREFIX)) return null
  const rest = slug.slice(SELL_PREFIX.length)
  const separator = rest.indexOf(BUY_SEPARATOR)
  if (separator <= 0) return null

  const sell = rest.slice(0, separator)
  const buy = rest.slice(separator + BUY_SEPARATOR.length)
  if (!sell || !buy) return null
  return { sell, buy }
}

function swapPairMarkdown(slug: string, pair: { sell: string; buy: string }) {
  const sell = pair.sell.toUpperCase()
  const buy = pair.buy.toUpperCase()

  return `# Swap ${sell} to ${buy} — THORChain Swap

Markdown view of ${AppConfig.baseUrl}/${slug}, the THORChain Swap page for swapping ${sell} to ${buy}.

This page is an interface to a native cross-chain swap: no bridge, no wrapped token, no account. A user either connects their own wallet and signs locally, or sends funds to a deposit address via a memoless ("instant") swap.

## Get A Live Quote

Rates, fees, and slippage are live and cannot be stated here. Fetch a quote from the public MCP server (no API key):

\`\`\`bash
curl -s ${AppConfig.baseUrl}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_swap_quote",
      "arguments": {
        "from_asset": "<CHAIN>.${sell}",
        "to_asset": "<CHAIN>.${buy}",
        "amount": "100000000"
      }
    }
  }'
\`\`\`

Assets use \`CHAIN.SYMBOL\` notation (\`BTC.BTC\`, \`ETH.ETH\`), and amounts are strings in 1e8 base units. Call \`list_pools\` to confirm both assets have an \`Available\` pool before quoting — not every symbol pair is tradable.

## Costs

Swapping costs protocol-level fees (inbound gas, outbound fee, liquidity fee), itemized in every quote. This interface adds no subscription or usage fee. See ${AppConfig.baseUrl}/pricing.md.

## Safety

- Quotes, memos, and inbound addresses expire — re-fetch before acting.
- Confirm the destination address before sending; transactions are irreversible.
- Never share private keys or seed phrases. No one operating this site will ask for them.

## More

- Swap interface: ${AppConfig.baseUrl}/${slug}
- Agent guidance: ${AppConfig.baseUrl}/AGENTS.md
- Developer resources: ${AppConfig.baseUrl}/developers.md
- Agent index: ${AppConfig.baseUrl}/llms.txt
`
}

// Returns the markdown twin for a page path ('/', '/developers', a pair slug),
// or null when the path has no markdown representation.
export function markdownForPage(pathname: string): string | null {
  if (pathname === '/' || pathname === '') return homeMarkdown
  if (pathname === '/developers') return developersMarkdown

  const slug = pathname.slice(1)
  if (slug.includes('/')) return null

  const pair = parsePair(slug)
  return pair ? swapPairMarkdown(slug, pair) : null
}

// Resolves a request path ending in .md to its page markdown. /index.md is the
// canonical markdown URL for the site root.
export function markdownForSuffixPath(pathname: string): string | null {
  if (!pathname.endsWith('.md')) return null

  const base = pathname.slice(0, -'.md'.length)
  if (base === '/index') return homeMarkdown
  return markdownForPage(base)
}
