import { createHash } from 'node:crypto'
import { AppConfig } from '@/config'
import { CORE_MCP } from '@/lib/agent/core-mcp'

// Published agent skills, one per capability area, served under
// /.well-known/agent-skills/<name>/SKILL.md and indexed in index.json.
// Each body carries YAML frontmatter (agentskills.io / skills.sh convention);
// add new skills to the SKILLS array and the routes follow automatically.

const frontmatter = (skill: { name: string; description: string; tags: string[] }) => `---
name: ${skill.name}
description: ${skill.description}
version: 1.1.0
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

const MCP_NOTE = `The canonical ${CORE_MCP.title} server at ${CORE_MCP.endpoint}, registered as [${CORE_MCP.registryName}](${CORE_MCP.registryUrl}), needs no API key, token, or OAuth client. Send \`Content-Type: application/json\` and \`Accept: application/json, text/event-stream\`; parse SSE \`data:\` events as JSON-RPC. Read \`result.structuredContent.data\` for the payload and \`_metadata\` for source/freshness. Get the complete live schemas from \`tools/list\` and ${CORE_MCP.serverCard}. It never holds keys, signs, or submits transactions.`

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
- Send feedback or support requests by email to ${AppConfig.supportEmail} or as a GitHub issue — never through the newsletter API.

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
- ${CORE_MCP.serverCard}
`

const quotes = `# THORChain Swap Quotes

Use this skill to fetch and interpret a live cross-chain swap quote from THORChain.

## When To Use

A user asks what they would receive swapping one native asset for another — "how much ETH for 0.5 BTC" — or wants the fees, slippage, or minimum sensible size for a pair.

## How To Call

${MCP_NOTE}

Call the \`quote_swap\` tool:

\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "quote_swap",
    "arguments": {
      "from_asset": "BTC.BTC",
      "to_asset": "ETH.ETH",
      "amount": 100000000
    }
  }
}
\`\`\`

## Conventions

- Assets use \`CHAIN.SYMBOL\` notation: \`BTC.BTC\`, \`ETH.ETH\`, \`ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48\`.
- Core MCP amount inputs are integers in 1e8 base units; returned amounts are generally strings — \`100000000\` is 1 BTC, regardless of the chain's own decimals.
- \`destination\` is optional for pricing. For executable deposit instructions, use core \`prepare_swap\` with a confirmed destination and never reuse its instructions after expiry.

## Reading The Result

- \`expected_amount_out\` — the estimate **after** fees. This is the number to quote a user.
- \`fees\` — the returned outbound, liquidity, and affiliate fees. Source-chain gas is paid separately by the user's wallet.
- \`fees.slippage_bps\` — price impact in basis points; grows with size against pool depth.
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

- \`list_pools\` — a pool array under \`structuredContent.data\` with \`asset\`, \`status\`, \`balance_asset\`, and \`balance_rune\`. Supports integer \`limit\` and \`offset\` for pagination.
- \`get_network_summary\` — compact node counts, APY, reserve, pooled RUNE, churn height, and vault migration status; takes no parameters.
- Core \`get_inbound_addresses\`, \`get_mimir\`, and \`get_outbound_fees\` provide chain halt configuration and fees. Read their exact current schemas from \`tools/list\`.

## Interpreting Pools

- \`status\` is \`available\` for pools open to trading; anything else cannot be swapped right now.
- Depths (\`balance_asset\`, \`balance_rune\`) are strings in 1e8 base units. Pool depth determines slippage — a trade that is small against a deep pool is cheap, the same trade against a shallow pool is not.
- Price fields may be empty in a pool response; do not infer a USD price when one is absent.

## Halts

Chains can be halted individually by the protocol. A halted chain means swaps in or out of that chain will not proceed, even though a quote may still compute. Check core \`get_inbound_addresses\` and \`get_mimir\` before telling a user a swap is available; the compact network summary does not replace chain halt checks.

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

## Check The Halt Switch First

THORChain can pause memoless swaps without halting any chain, by setting \`HALTMEMOLESS\` in Mimir. Read \`https://thornode.ninerealms.com/thorchain/mimir\` and treat any value greater than 0 for \`HALTMEMOLESS\` as "wallet-free swaps are unavailable right now": tell the user to swap from a connected wallet instead, and never hand out a deposit address while the halt is up.

## What An Agent Should And Should Not Do

- **Do** explain the flow, help pick the pair, and surface the quote via \`quote_swap\`.
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
