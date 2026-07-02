import { createHash } from 'node:crypto'

export const agentSkillMarkdown = `# THORChain Swap Agent Skill

Use this skill when an agent needs to understand or navigate the public THORChain Swap interface.

## What This Site Does

THORChain Swap is a public web interface for native cross-chain swaps powered by THORChain and Maya Protocol providers.

## Safe Public Actions

- Read public discovery documents.
- Open the swap interface.
- Open the pool, bond, memo, TCY, and THORName public interfaces.
- Submit feedback only through the documented public API.

## Safety Rules

- Do not request, store, or infer private keys or seed phrases.
- Do not execute swaps for a user.
- Do not connect wallets without explicit user action in the browser.
- Treat quotes, balances, and transaction state as time-sensitive.
- Confirm destination addresses before any user submits a transaction.

## Discovery URLs

- https://swap.thorchain.org/robots.txt
- https://swap.thorchain.org/sitemap.xml
- https://swap.thorchain.org/.well-known/api-catalog
- https://swap.thorchain.org/.well-known/openapi.json
- https://swap.thorchain.org/auth.md
`

export const authMarkdown = `# auth.md

THORChain Swap publishes public discovery metadata for agents.

## Audience

This document is for agents and developers inspecting the public THORChain Swap web interface and its public support APIs.

## Current Authentication Model

The public web interface does not require account authentication for browsing.
Wallet connection and transaction signing are performed by user-controlled wallets in the browser.

The public support APIs documented in the API catalog are unauthenticated at the HTTP layer and may enforce server-side abuse controls.
There is no public self-service OAuth credential issuance for agents at this time.

## Discovery Metadata

- OAuth authorization server metadata: https://swap.thorchain.org/.well-known/oauth-authorization-server
- OAuth protected resource metadata: https://swap.thorchain.org/.well-known/oauth-protected-resource
- OpenID configuration: https://swap.thorchain.org/.well-known/openid-configuration
- API catalog: https://swap.thorchain.org/.well-known/api-catalog

## Agent Registration

Self-service agent registration is not currently enabled.
Teams that need authenticated integration access should coordinate with the THORChain Swap maintainers.
`

export function sha256Digest(value: string) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}
