# Borrow tab

Borrow is a subtab under DeFi, alongside Automated Trading, Lending, and Staking. The DeFi container owns the main header and subheader; the Borrow
component owns the existing form and calculations.

Borrow is a read-only referral form. The **Borrow on Rujira** action opens `https://rujira.network/borrow/{collateral}/{debt}` in a new tab with the
selected assets. Chain suffixes distinguish noncanonical assets, and `toChain` preserves the selected external payout network. For example, BTC
collateral with Ethereum USDC opens `/borrow/BTC/USDC?toChain=ETH`. It never signs or submits a transaction; amounts are local previews and are not
forwarded. Before asset data loads, the link falls back to `/borrow`.

The row below the LTV slider shows Available to borrow for the selected debt asset: the smaller of the vault's remaining liquidity
(`depositPool.size - debtPool.size`, floored at zero) and `borrower.available`, converted using the secured market's decimals. This is market
availability; the entered collateral and protocol LTV limits still determine the user's borrowing capacity.

The form and asset picker live in `src/components/borrow/`. They reuse the existing inputs, dialog/drawer, buttons, wallet balance hook, and trading
tabs. Borrow selections are separate from swap state and do not request swap quotes.

The shared Radix slider at the bottom of the Borrow field spans 0–100% actual risk-adjusted LTV and updates the borrow amount. The summary below shows
projected annual interest, the selected asset's collateral ratio, a collateral liquidation-price estimate, and LTV. These are previews for the entered
amounts; the outgoing link does not submit them. The slider has a uniform height and transitions through green (0–30%), yellow (30–50%), orange
(50–70%), and red (70–100%). These visual bands do not replace the live protocol limits shown in the tooltip.

Liquidation price displays the collateral asset's logo followed by its estimated USD price per token at liquidation. This estimate holds the borrowed
asset's USD price unchanged.

`src/lib/rujira/borrow-preview.ts` applies the collateral ratio before computing LTV, uses the live liquidation threshold for the price estimate, and
projects interest from the vault utilization curve. Pool sizes use secured-token decimals, which can differ from the selected Layer 1 asset. Missing
data or an empty deposit disables the slider. A zero debt or same-asset pair has no separate liquidation price. The LTV tooltip shows the live
borrowing and liquidation limits; the 100% slider endpoint does not imply that the whole range is borrowable.

## Data

- `data/graphql/rujira-schema.graphql`: copied from `onthego/packages/main/data/schema.graphql`, the main application schema. Borrow keeps the Main
  API's `ghostCredit` integration; the separate `rujira-analytics-schema.graphql` contract is used by Automated Trading, Lending and Staking.
- `src/lib/rujira/borrow-query.ts`: the read-only GraphQL operation.
- `src/lib/rujira/client.ts`: server-side request, optional API key and timeout.
- `src/lib/rujira/borrow-markets.ts`: typed response and selector mapping.
- `src/app/api/borrow/markets/route.ts`: same-origin endpoint.
- `src/hooks/use-borrow-markets.ts`: React Query cache and refresh.

The default endpoint is `https://api.rujira.network/api/graphql`. Set `RUJIRA_GRAPHQL_URL` to override it and optionally `RUJIRA_API_KEY` for a Bearer
token. Neither variable uses the `NEXT_PUBLIC_` prefix. Public reads were verified without a key; API access policies may change.

For authenticated access, add these entries to the local `.env` and restart the dev server (configure the same values in the hosting environment for
deployment):

```dotenv
RUJIRA_GRAPHQL_URL=https://api.rujira.network/api/graphql
RUJIRA_API_KEY=<your-api-key>
```

The browser requests `/api/borrow/markets`; only the server sends the API key to Rujira. Successful responses are cached for 30 seconds, concurrent
requests share one upstream request, and public-bucket errors get one delayed retry. Failures are not cached. A failed background refresh keeps the
last loaded data visible without a UI error message. Initial-load failures still show an error and retry action. The browser waits before retrying a
rate-limited response. Server logs retain the upstream error message; the UI receives only a reason code and user-facing copy.

Deposit lists `ghostCredit.collaterals` with `BigInt(ratio) > 0n`. Borrow lists `ghostCredit.vaults`; temporary zero availability does not remove a
supported lending asset. Selectors display each asset's Layer 1 variant when present, while retaining its collateral/vault identity in `marketId`.
Oracle prices have 12 decimal places. Missing prices show an em dash, not a fabricated zero price.

Token icons prefer GraphQL metadata. When it omits an image for Ethereum USDC or USDT, Borrow uses Rujira UI's Cloudflare Images CDN
(`rujira-ui/tokens/<symbol>.png/public`). These token images are not copied into this repository.

React Query is already used by this repo, so this integration does not require Relay or a second client cache. The schema is a development contract,
not a runtime API. After updating it, run `npm run test:borrow` to check the query and asset filtering, then `npx tsc --noEmit -p tsconfig.json`.
