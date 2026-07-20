import { createHash } from 'node:crypto'
import { AppConfig } from '@/config'

// Published agent skills, one per capability area, served under
// /.well-known/agent-skills/<name>/SKILL.md and indexed in index.json.
// Each body carries YAML frontmatter (agentskills.io / skills.sh convention);
// add new skills to the SKILLS array and the routes follow automatically.

const frontmatter = (skill: { name: string; description: string; tags: string[] }) => `---
name: ${skill.name}
description: ${skill.description}
version: 1.0.0
license: MIT
homepage: ${AppConfig.baseUrl}
tags: [${skill.tags.join(', ')}]
---

`

const SAFETY = `## Safety Rules

- Never request, store, or infer private keys or seed phrases.
- Never execute a swap on a user's behalf; users sign in their own wallets, or send funds themselves in a memoless swap.
- Treat quotes, memos, inbound addresses, and balances as time-sensitive; re-fetch before presenting them.
- Confirm the destination address with the user before they submit any transaction.
- A transaction is irreversible once broadcast. Say so before the user commits.`

const MCP_NOTE = `The public MCP server at ${AppConfig.baseUrl}/mcp is unauthenticated, rate limited, read-only, and needs no API key. It never holds keys, signs, or submits transactions.`

const overview = `# THORChain Swap Agent Skill

Use this skill when an agent needs to understand or navigate the public THORChain Swap interface.

## What This Site Does

THORChain Swap is a public web interface for native cross-chain swaps powered by THORChain and Maya Protocol.
Users either connect their own wallet and sign locally, or swap without connecting a wallet via memoless ("instant") swaps.
There are no accounts, no bridges, and no wrapped assets.

## Safe Public Actions

- Read public discovery documents (llms.txt, AGENTS.md, developers.md, pricing.md).
- Open the swap interface and the pool, bond, memo, TCY, and THORName interfaces.
- Fetch quotes, pools, and network data through the public MCP server.
- Submit feedback only through the documented public API.

## Related Skills

- \`thorchain-swap-quotes\` — get and interpret a cross-chain swap quote.
- \`thorchain-liquidity-pools\` — inspect pool depths and network status.
- \`thorchain-memoless-swap\` — guide a wallet-free swap.

${MCP_NOTE}

${SAFETY}

## Discovery URLs

- ${AppConfig.baseUrl}/llms.txt
- ${AppConfig.baseUrl}/AGENTS.md
- ${AppConfig.baseUrl}/developers.md
- ${AppConfig.baseUrl}/pricing.md
- ${AppConfig.baseUrl}/.well-known/openapi.json
- ${AppConfig.baseUrl}/.well-known/mcp-server-card
`

const quotes = `# THORChain Swap Quotes

Use this skill to fetch and interpret a live cross-chain swap quote from THORChain.

## When To Use

A user asks what they would receive swapping one native asset for another — "how much ETH for 0.5 BTC" — or wants the fees, slippage, or minimum sensible size for a pair.

## How To Call

${MCP_NOTE}

Call the \`get_swap_quote\` tool:

\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_swap_quote",
    "arguments": {
      "from_asset": "BTC.BTC",
      "to_asset": "ETH.ETH",
      "amount": "100000000",
      "destination": "0x…"
    }
  }
}
\`\`\`

## Conventions

- Assets use \`CHAIN.SYMBOL\` notation: \`BTC.BTC\`, \`ETH.ETH\`, \`ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48\`.
- Amounts are strings in 1e8 base units — \`100000000\` is 1 BTC, regardless of the chain's own decimals.
- \`destination\` is optional, but without it the quote has no usable memo.

## Reading The Result

- \`expected_amount_out\` — the estimate **after** fees. This is the number to quote a user.
- \`fees\` — itemized: inbound gas, outbound fee, liquidity fee, and any provider service fee.
- \`slippage_bps\` — price impact in basis points; grows with size against pool depth.
- \`recommended_min_amount_in\` — below this, fees dominate and the trade is not economical.
- \`memo\` and \`inbound_address\` — the transaction details. **Both expire.** Never reuse them after expiry, and never present a stale pair.

Quotes are indicative, not guaranteed. Re-fetch immediately before a user acts.

${SAFETY}
`

const pools = `# THORChain Liquidity Pools

Use this skill to inspect THORChain liquidity pools and network status.

## When To Use

A user asks which assets are swappable, how deep a pool is, whether a chain is halted, or what the current outbound fees are.

## How To Call

${MCP_NOTE}

- \`list_pools\` — every pool with \`asset\`, \`status\`, \`balance_asset\`, \`balance_rune\`, and \`asset_tor_price\` (USD price of the asset).
- \`get_network_status\` — current network parameters, including outbound fees and halt-related gas information.

Neither tool takes arguments.

## Interpreting Pools

- \`status\` is \`Available\` for pools open to trading; anything else cannot be swapped right now.
- Depths (\`balance_asset\`, \`balance_rune\`) are strings in 1e8 base units. Pool depth determines slippage — a trade that is small against a deep pool is cheap, the same trade against a shallow pool is not.
- \`asset_tor_price\` is the USD price in 1e8 units, useful for converting quotes to fiat for display.

## Halts

Chains can be halted individually by the protocol. A halted chain means swaps in or out of that chain will not proceed, even though a quote may still compute. Check network status before telling a user a swap is available.

${SAFETY}
`

const memoless = `# THORChain Memoless (Wallet-Free) Swaps

Use this skill when a user wants to swap without connecting a wallet.

## When To Use

The user has funds in an exchange, a hardware wallet, or any wallet that cannot connect to a web app, and wants to swap native assets anyway.

## How It Works

A memoless ("instant") swap replaces the transaction memo with a dedicated deposit address:

1. The user chooses the pair and provides a destination address they control.
2. The service returns a deposit address for the source asset.
3. The user sends the source asset to that deposit address from anywhere.
4. The protocol swaps and delivers the output to the destination address.

The endpoint is \`https://api.thorchain.org/memoless/api/v1\` and needs no API key. The interface at ${AppConfig.baseUrl}/ drives the same flow for humans.

## What An Agent Should And Should Not Do

- **Do** explain the flow, help pick the pair, and surface the quote via \`get_swap_quote\`.
- **Do** make the user verify the destination address character by character before sending — output goes there permanently.
- **Do** warn that deposit addresses and quotes expire, and that sending after expiry risks loss or refund delay.
- **Do not** send funds, hold funds, or complete the transfer for the user. The user always moves their own money.

## Failure Modes To Warn About

- Sending an asset other than the one quoted, or on the wrong chain, to the deposit address.
- Sending less than \`recommended_min_amount_in\`, where fees consume the trade.
- Reusing an old deposit address from a previous quote.

${SAFETY}
`

interface AgentSkill {
  name: string
  description: string
  tags: string[]
  body: string
}

const SKILL_SOURCES: AgentSkill[] = [
  {
    name: 'thorchain-swap',
    description: 'Navigate and inspect the public THORChain Swap interface safely.',
    tags: ['thorchain', 'swap', 'discovery', 'defi'],
    body: overview
  },
  {
    name: 'thorchain-swap-quotes',
    description: 'Fetch and interpret live cross-chain swap quotes, fees, and slippage from THORChain.',
    tags: ['thorchain', 'swap', 'quotes', 'pricing', 'defi'],
    body: quotes
  },
  {
    name: 'thorchain-liquidity-pools',
    description: 'Inspect THORChain liquidity pool depths, asset prices, and network or chain halt status.',
    tags: ['thorchain', 'liquidity', 'pools', 'network', 'defi'],
    body: pools
  },
  {
    name: 'thorchain-memoless-swap',
    description: 'Guide a user through a wallet-free (memoless) cross-chain swap using a deposit address.',
    tags: ['thorchain', 'swap', 'memoless', 'wallet-free', 'defi'],
    body: memoless
  }
]

function sha256Digest(value: string) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

export const AGENT_SKILLS = SKILL_SOURCES.map(skill => {
  const markdown = frontmatter(skill) + skill.body
  return {
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    path: `/.well-known/agent-skills/${skill.name}/SKILL.md`,
    url: `${AppConfig.baseUrl}/.well-known/agent-skills/${skill.name}/SKILL.md`,
    markdown,
    digest: sha256Digest(markdown)
  }
})
