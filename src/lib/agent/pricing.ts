import { AppConfig } from '@/config'

// Machine-readable pricing, served at /pricing.md and summarised in the
// ?mode=agent view. THORChain Swap sells nothing: the plans below exist so
// agents comparing products can see there is no paywall, and so the real
// per-swap costs (protocol fees, not our fees) are stated in one place.

export const pricingPlans = [
  {
    name: 'Web interface',
    price: 'Free',
    audience: 'Anyone swapping native layer-1 assets',
    limits: 'No accounts, no sign-up, no usage caps'
  },
  {
    name: 'Public MCP server + REST APIs',
    price: 'Free, no API key',
    audience: 'Agents and developers reading quotes, pools, and network data',
    limits: 'Per-client rate limits; 429 with Retry-After when exceeded'
  },
  {
    name: 'Swap aggregator API',
    price: 'No published price — access by arrangement',
    audience: 'Partners needing direct quote/routing access to api.thorchain.org/v1',
    limits: 'Requires an x-api-key header; keys are not self-service'
  }
]

export const pricingMarkdown = `# THORChain Swap Pricing

THORChain Swap (${AppConfig.baseUrl}) is free to use. There are no accounts, subscriptions, seats, credits, or usage tiers, and the public agent surfaces need no API key.

## Plans

| Plan | Price | Who it is for | Limits |
| --- | --- | --- | --- |
${pricingPlans.map(plan => `| ${plan.name} | ${plan.price} | ${plan.audience} | ${plan.limits} |`).join('\n')}

## What a swap costs

This interface does not add a subscription or usage fee to a swap. The costs on any given swap are protocol- and network-level, and every quote itemises them in its \`fees\` object before the user commits:

- **Inbound gas** — the network fee on the source chain, paid by the user's own wallet.
- **Outbound fee** — the destination chain fee THORChain charges to send the output.
- **Liquidity fee** — the slippage-based fee paid to liquidity providers; scales with trade size against pool depth.
- **Service / affiliate fee** — some aggregated third-party routes include a provider fee. When present it is itemised in the quote like any other fee; it is not a charge added by this interface.

Amounts across THORChain APIs are strings in 1e8 base units. \`expected_amount_out\` in a quote is already net of these fees, and \`recommended_min_amount_in\` marks the point below which fees dominate the trade.

## Getting a cost estimate programmatically

Call the \`get_swap_quote\` tool on the public MCP server at ${AppConfig.baseUrl}/mcp — no key, no billing. The result carries the itemised fees and \`slippage_bps\` for the pair and size you ask about. Quotes expire; re-fetch before presenting numbers to a user.

## Currency and billing

- Fees are denominated in the assets being swapped, not in fiat; quotes include USD estimates for display.
- No invoices, no card on file, no checkout: this interface never holds user funds and cannot charge a user.
- Users pay network and protocol fees directly from their own wallet as part of the transaction they sign.

## More

- Developer portal: ${AppConfig.baseUrl}/developers (markdown: ${AppConfig.baseUrl}/developers.md)
- Authentication model: ${AppConfig.baseUrl}/auth.md
- Agent index: ${AppConfig.baseUrl}/llms.txt
`
