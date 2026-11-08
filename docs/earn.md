# DeFi tab

DeFi follows Private in the main header. Its subheader contains Automated Trading, Lending, Staking, and Borrow. The Automated Trading CTA opens
`https://rujira.network/earn-opportunities` with `?asset=<selected ticker>` when an asset is selected, or without a filter for All assets. Lending and
Staking open `https://rujira.network/earn-opportunities/welcome`. These CTAs open in a new tab and never submit a transaction.

Borrow reuses the existing form and data integration under the same subheader, with its own asset-specific CTA. See `borrow.md`.

## Data and ranking

The integration uses both schemas in `data/graphql/`: `rujira-schema.graphql` for market identities and prices, and the supplied
`rujira-analytics-schema.graphql` for CCL and 30-day staking APRs. It shares Borrow's server-only API-key configuration. See `borrow.md` for `.env`
setup. Public access can be rate-limited.

- Automated Trading paginates the complete `finV3.pairs` catalogue, offering the union of base and quote assets. A separate paginated analytics query
  reads `analytics.products.amm.strategies` filtered to CCL, with 30-day APR. Full pair contract addresses join the two responses. Only actual CCL
  strategy rows enter the ranking, while all Trade assets remain selectable. Selecting an asset matches either side before taking three. The old
  `rangeSummary.aprMonth` field is not used as an analytics fallback.
- Lending paginates `strategies(typenames: ["GhostVault"])` and ranks supply APR from `status.lendRate`. A particular asset can have fewer than three
  matching vaults. This catalogue is broader than Borrow's credit-supported debt assets.
- Staking uses Main `staking.pools` for identities and Analytics `staking(token: RUJI | BRUNE | TCY).history` at daily resolution over the last 30
  complete UTC days. The displayed APR is the mean of valid completed daily APRs, including genuine zeroes. Missing, invalid, negative, or unfinished
  points are excluded; no valid points displays `N/A`. The header says `APR (30d)`. Neither the current snapshot nor the legacy Main summary is a
  fallback. Pool assets are matched by full canonical identity, not arbitrary ticker copies.

Main Bigint prices and lending rates have 12 decimal places. Analytics APRs are already decimal ratios and are never divided by 1e12. Ranking
preserves decimal precision before display rounding. Full identifiers preserve chain and contract variants. Zero is a valid reported value; null or
unavailable data displays `N/A`. Missing rows also show `N/A`, so the summary always has three slots.

Each mode loads independently through `/api/earn/markets?mode=...`. Successful catalogues are cached for one minute and concurrent loads are
deduplicated. Catalogue pagination must complete before ranking; partial pages are not shown as the complete asset list. The browser caches modes
separately.

The Swap page preloads all three earning modes and Borrow once the browser is idle (with a three-second timeout/timer fallback). Requests run
sequentially and populate the same React Query caches the DeFi tabs use. Prefetch failures stay silent and do not retry; opening a tab retains its
normal retries and refresh interval. Prefetching does not start background polling for unopened tabs.

Failed background refreshes keep the last loaded data without a UI error message. A refresh with unavailable analytics also preserves the previous
snapshot instead of replacing rates with N/A. Initial-load failures still show the error or missing-rates message and retry action.

Set `RUJIRA_ANALYTICS_GRAPHQL_URL` to override the default `https://analytics.rujira.network/api/v2/graphql`. It stays server-only. Market catalogues
and analytics load independently: if analytics fails, asset selection and prices remain available, rates show `N/A` with a retry message, and the
partial result is not cached as a completed success.

## UI

Only Automated Trading shows the Earn with asset filter. A separate Popular row sits between this card and the positions card, with shortcuts for BTC,
ZEC, native ETH, and Ethereum USDC. Each shortcut selects the matching catalogue asset and filters the positions; unavailable assets stay disabled. It
has no amount input or balance shortcuts. Lending and Staking show their overall top three opportunities and referral CTA.

`src/components/earn/` contains the screen and overlapping token logos, sourced from GraphQL metadata or Rujira's Cloudflare Images CDN. The asset
picker shares Swap's chain filter component: a vertical chain sidebar on desktop and a horizontal strip on mobile, with search and a single-column
asset list beside/below it. All Chains is selected by default, and All assets clears the asset selection. Borrow keeps its two-column asset list.

Run `npm run test:earn`, `npm run test:borrow`, and `npx tsc --noEmit -p tsconfig.json` for focused validation.
