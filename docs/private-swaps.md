# Private swaps (Houdini)

The third tab on the swap form. A private swap is not a THORChain or Maya swap: it is routed through [Houdini Swap](https://houdiniswap.com) in its
_private_ mode — two centralized-exchange hops, optionally through Monero, with no on-chain link between the deposit and the payout. The user sends a
deposit to an address Houdini hands out and Houdini pays the receiving address, so no wallet connection is needed on any chain; a connected wallet is
only a convenience that signs the deposit.

## Where the pieces live

```
PRIVATE tab ──quote──▶ api.thorchain.org/v1/quote  providers: ["HOUDINI"]  ──▶ Houdini partner API (server-side key)
                                     │  dry: indicative price + limits
                                     │  non-dry: creates the Houdini order → deposit address, exact amount, QR, houdiniId
             ──track──▶ api.thorchain.org/v1/track  provider: HOUDINI, providerSwapId: <houdiniId>
```

- **SDK** — `ProviderName.HOUDINI`, the `meta.houdini` and `qrCodeDataURL` fields on a quote route, and `@tcswap/plugins/houdini`,
  whose `swap()` is a plain `wallet.transfer` of `route.sellAmount` to `route.inboundAddress` (with `route.memo` when the order needs a deposit memo).
- **This app** — `isPrivateSwap` in `src/store/limit-swap-store.ts` (the tab; each mode's setter clears the other, re-exported from
  `src/store/private-swap-store.ts`), `AppConfig.privateProvider`,
  `useModeAssets` / `isAssetInMode` in `src/hooks/use-assets.ts` (each tab has its own asset list; `PRIVATE_SWAP_CHAINS` limits Houdini's catalogue to
  chains this app can validate addresses for and show), `useQuote` (quotes the private provider alone), and the `HOUDINI` branches in the recipient /
  confirm / deposit / wallet dialogs and the history dialog. The tab itself carries no explanatory block: what a private route costs in time and what
  its limits are come from the quote, and the confirm screen is where they are stated.

## The flow, step by step

1. **Quote** — `useQuote` asks for `providers: [HOUDINI]` without streaming options. The dry route carries `meta.houdini.{quoteId, min, max, swapName,
   markup}`, and an amount outside the route's limits comes back as a quote error the form shows like any other.
2. **Addresses** — `SwapRecipient` asks for the receiving address and, without a wallet, a refund address on the sell chain (Houdini refunds a failed
   order there). With a wallet the source address is the refund address.
3. **Order** — the non-dry quote creates the Houdini order. `inboundAddress` is the deposit address, `sellAmount` is the exact amount the order expects
   (Houdini restates it with the venue's rounding), `expiration` is when the unfunded order lapses (~30 minutes), `meta.houdini.houdiniId` is the order
   id. Without a wallet the route also carries `qrCodeDataURL`; `InstantSwapDialog` shows it exactly like a memoless deposit. With a wallet
   `SwapDialog` confirms and `uSwap.swap` runs the Houdini plugin.
4. **Tracking** — the transaction stores `providerSwapId` (the order id) and `useSyncTransactions` sends it on `/track`. The history dialog links to the
   public order page (`app.houdiniswap.com/order-details?houdiniId=<id>`), which also carries Houdini's support chat.

## What is deliberately different from a native swap

- **Floating rate.** The payout is re-priced when the deposit lands. The confirm screen shows _Rate: Floating_ and the route instead of the minimum
  payout and slippage tolerance; price impact stays, as the USD cost of the route. A more-than-2% cost still needs the acknowledgement checkbox, with
  private-specific wording.
- **No halts.** Mimir halts stop THORChain and Maya, not Houdini; the halt banner and the greyed-out assets only apply on the other tabs.
- **No XRP sells, self-custody destinations.** A CEX deposit on XRP is identified by a destination tag and the SDK's XRP toolbox only carries
  free-text memos, so the aggregator refuses XRP as the sell asset. Buying XRP privately works, but only to a self-custody address: no destination
  tag/memo is sent with the order, so an exchange-hosted receiving address on a memo chain would be paid untagged.
- **Deposit memos.** When the order needs a deposit memo (ATOM, TON, RUNE to a venue that uses one) it arrives as `route.memo`, is stored on the
  transaction as `depositMemo`, and is shown beside the QR code — which then encodes the bare address, as it does for any token deposit, since a
  payment URI cannot carry a memo and would read a token amount as native coin.
- **Tracking.** Houdini watches the deposit itself, so the app never expires a Houdini order on its local clock; it becomes *Expired* when Houdini
  says so, or when Houdini no longer knows the order (48h) and never saw a deposit.
- **Chains.** Houdini lists more chains than `PRIVATE_SWAP_CHAINS` (Monero, Stellar, Algorand, …). Adding one means an SDK address validator and a
  `public/networks/<chain>.svg` icon first.
- **Fees.** The aggregator sends its configured `HOUDINI` service/affiliate bps to Houdini as the partner markup (percent = bps / 100, capped at 4%)
  and reports them as fees in the sell asset. The swap app's zero-fee rule for THORChain-listed pairs does not zero the Houdini markup.
