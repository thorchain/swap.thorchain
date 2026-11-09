# DeFi tab

DeFi follows Private in the main header. Its subheader contains Automated Trading, Lending, Staking, and Borrow. The Automated Trading CTA opens
`https://rujira.network/earn-opportunities` with `?asset=<selected ticker>` when an asset is selected, or without a filter for All assets. Lending and
Staking open `https://rujira.network/earn-opportunities/welcome`. These CTAs open in a new tab and never submit a transaction.

Borrow reuses the existing form and data integration under the same subheader, with its own asset-specific CTA. See `borrow.md`.

## Data and ranking

Automated Trading, Lending and Staking use Analytics v2 through `src/lib/rujira/client.ts`, including asset catalogues, token metadata and APRs, with
no Main API fallback. Borrow uses the Main Rujira API. The Earn development contract is `data/graphql/rujira-analytics-schema.graphql`. See
`borrow.md` for the shared server-only API-key configuration. Public access can be rate-limited.

The Analytics SDL includes the supplied November 9 structure document, preserved at `data/graphql/rujira-analytics-structure.json`. That source is a
`REVIEW_DRAFT`, so the local contract includes proposed fields not yet available in the deployed API. Its `Decimal` notation maps to the existing
`DecimalValue` scalar; undocumented compatibility fields from the previous SDL are retained.

xUSK, NAMI, and AUTO are excluded from Earn asset lists and opportunities in every mode, including pairs containing any of these assets.

- Automated Trading paginates the complete `analytics.products.trade.pairs` catalogue, offering the union of base and quote tokens. A separate v2
  query reads `analytics.products.amm.strategies` filtered to CCL and DCL with `onePerPair: true` and 30-day APR. v2 selects the higher available
  whole-strategy APR for each pair before sorting and pagination. Missing/null DCL APR does not replace a valid CCL APR; zero remains valid. New DCL
  markets join automatically when the API publishes them. Stable v2 pair IDs join the responses, while all Trade assets remain selectable. Selecting
  an asset matches either side before taking three. The old `rangeSummary.aprMonth` field is not used as an analytics fallback. The list is labelled
  `Top Pairs` with `Average APR`; pairs with TCY or ATOM on either side are excluded from this ranking before selecting the top three.
- Lending paginates Analytics v2 `analytics.products.moneyMarket.markets`, including token metadata, and ranks `apr(side: LENDING)` without a Main API
  request. These are current supply APRs, not 30-day averages or borrowing costs. Full token IDs preserve network and contract variants;
  network-qualified symbols use the existing separate chain badge. This catalogue is broader than Borrow's credit-supported debt assets.
- Staking uses v2 `staking(token: RUJI | BRUNE | TCY).pool.stakedToken` for identities and
  `current.apr(averageOver: { trailing: { value: 30, unit: DAY } })` for the API's 30-day average, together in one request. The API averages completed
  UTC days and returns null when any day's value is unavailable. No local averaging or fallback is applied. The header says `APR (30d)`. Pool assets
  are matched by full canonical identity, not arbitrary ticker copies.

Analytics APRs are already decimal ratios and are never divided by 1e12. Ranking preserves decimal precision before display rounding. Full identifiers
preserve chain and contract variants. Zero is a valid reported value; null or unavailable data displays `N/A`. A null APR is a successful response, is
cached normally, and does not trigger an error or retry message. Automated Trading shows only existing matching positions, up to three. When a
successfully loaded catalogue has no matching positions, it shows `No position opened` without an APR header. Lending and Staking retain three slots,
showing `N/A` for missing rows.

Each mode loads independently through `/api/earn/markets?mode=...`. Successful catalogues are cached for one minute and concurrent loads are
deduplicated. Catalogue pagination must complete before ranking; partial pages are not shown as the complete asset list. The browser caches modes
separately.

The Swap page preloads all three earning modes and Borrow once the browser is idle (with a three-second timeout/timer fallback). Requests run
sequentially and populate the same React Query caches the DeFi tabs use. Prefetch failures stay silent and do not retry; opening a tab retains its
normal retries and refresh interval. Prefetching does not start background polling for unopened tabs.

Failed background refreshes keep the last loaded data without a UI error message. A refresh with unavailable analytics also preserves the previous
snapshot instead of replacing rates with N/A. Initial-load failures still show the error or missing-rates message and retry action.

Set `RUJIRA_ANALYTICS_GRAPHQL_URL` to override the default `https://analytics.rujira.network/api/v2/graphql`. It stays server-only. Automated Trading
loads its v2 Trade catalogue and CCL/DCL metrics independently: if the metrics request fails, asset selection remains available, rates show `N/A` with
a retry message, and the partial result is not cached as a completed success. Other request failures follow the normal initial-load error and
background-refresh handling. Null namespaces and null rates are valid responses and do not trigger errors; unavailable catalogues become empty lists.
Pagination does not expose a partial list when a later page is null.

## UI

Only Automated Trading shows the Earn with asset filter. A separate Popular row sits between this card and the positions card, with shortcuts for BTC,
ZEC, native ETH, and Ethereum USDC. Each shortcut selects the matching catalogue asset and filters the positions; unavailable assets stay disabled. It
has no amount input or balance shortcuts. Lending and Staking show their overall top three opportunities and referral CTA.

Earn and Borrow share `src/components/defi-asset-icon.tsx`, using token images from GraphQL metadata or Rujira's Cloudflare Images CDN and the
existing asset renderer for chain badges on USDT, USDC, and ETH only. `src/components/earn/` contains the screen and overlapping token logos. The
asset picker shares Swap's chain filter component: a vertical chain sidebar on desktop and a horizontal strip on mobile, with search and a
single-column asset list beside/below it. All Chains is selected by default, and All assets clears the asset selection. Borrow keeps its two-column
asset list.

Run `npm run test:earn`, `npm run test:borrow`, and `npx tsc --noEmit -p tsconfig.json` for focused validation.
