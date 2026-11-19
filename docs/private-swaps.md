# Private swaps (Houdini)

The third tab on the swap form. A private swap is not a THORChain or Maya swap: it is routed through [Houdini Swap](https://houdiniswap.com) in its
_private_ mode — two centralized-exchange hops, optionally through Monero, with no on-chain link between the deposit and the payout. The user sends a
deposit to an address Houdini hands out and Houdini pays the receiving address, so no wallet connection is needed on any chain; a connected wallet is
only a convenience that signs the deposit.

## Where the pieces live

```
PRIVATE tab ──rate────▶ /v3/rate     privacy: ["basic"]            indicative price + limits, nothing created
             ──preview─▶ /v3/preview  provider: HOUDINI_PRIVATE     the route with addresses + a previewToken, still nothing created
             ──commit──▶ /v3/commit   previewToken                  creates the Houdini order → deposit address, exact amount, QR, houdiniId, uuid
             ──track───▶ /v3/track    uuid (+ the deposit's hash when a wallet paid it)
```

The aggregator is `../tcswap-server`; its contract is `API_V3.md` there. It holds the Houdini partner key.

- **One Houdini provider.** `HOUDINI_PRIVATE` (privacy level `basic`) runs the swap over two exchanges in sequence and is the only provider that
  takes a same-asset pair; it is the PRIVATE tab (`PRIVATE_PROVIDER` in `src/lib/aggregator.ts`). The aggregator quotes Houdini's private routes
  only, so Houdini never appears on the SWAP tab, and `HOUDINI` as a provider is refused with a `400`. `isHoudiniProvider` still matches that
  older name, which the same private routes had on `/v1`, for swaps stored in the history back then.
- **No provider list.** A comparison never names providers; the tab asks for its rail through `privacy`, and the server picks. Only the preview
  names its one `provider`, as the contract requires.
- **This app** — `isPrivateSwap` in `src/store/limit-swap-store.ts` (the tab; each mode's setter clears the other, re-exported from
  `src/store/private-swap-store.ts`), `useModeAssets` / `isAssetInMode` in `src/hooks/use-assets.ts` (each tab has its own asset list, by the providers the
  catalog tags each asset with), `useQuote`, and the
  Houdini branches in the recipient / confirm / deposit / wallet dialogs and the history dialog. The tab itself carries no explanatory block: what
  a private route costs in time and what its limits are come from the quote, and the confirm screen is where they are stated.
- **SDK** — only its wallets and toolboxes. The deposit is a plain `wallet.transfer` made by `executeRoute` (`src/lib/execute-route.ts`); the
  SDK's Houdini plugin is not used, since it looks routes up by the older `ProviderName.HOUDINI` alone.

## The flow, step by step

1. **Quote** — `useQuote` sends `/v3/rate` with `privacy: ["basic"]` and no streaming options. The route carries `meta.houdini` (the venue as
   `swapName`, the limits `min` / `max`, and `requiresRefundAddress` when the route needs one), and an amount outside the limits comes back as a
   quote error the form shows like any other. `minBuyAmount` is `null` on a floating route.
2. **Addresses** — `SwapRecipient` asks for the receiving address only and sends `/v3/preview`. Without a wallet no refund address is asked for up
   front (a failed order is recovered through Houdini support, the order page); only when the route needs one does the aggregator answer with an
   error naming the refund address, and the refund field appears for the retry. With a wallet the source address is the refund address. The preview
   creates nothing and returns the `previewToken`.
3. **Order** — pressing Swap commits the token, which creates the Houdini order. On the committed route `inboundAddress` is the deposit address,
   `sellAmount` is the exact amount the order expects (Houdini restates it with the venue's rounding), `expiration` is when the unfunded order
   lapses, `meta.houdini.houdiniId` is the order id and `uuid` the tracking handle. The route also carries `qrCodeDataURL`; without a wallet
   `InstantSwapDialog` shows it exactly like a memoless deposit. With a wallet `SwapDialog` commits and `executeRoute` transfers the deposit from
   the selected account. A commit can answer that the preview lapsed or the rate moved past the slippage (`QuoteChangedError`); the dialog then
   goes back to the address step for a new preview.
4. **Tracking** — the transaction stores the `uuid`, which `useSyncTransactions` polls `/v3/track` with, and `providerSwapId` (the order id), which
   the history dialog uses to link the public order page (`app.houdiniswap.com/order-details?houdiniId=<id>`, also Houdini's support chat). An order
   stored before tracking moved to `uuid` cannot be followed any more and shows as unknown, with its order link.

## What is deliberately different from a native swap

- **Floating rate.** The payout is re-priced when the deposit lands. The confirm screen shows _Rate: Floating_ and the route instead of the minimum
  payout and slippage tolerance; price impact stays, as the USD cost of the route. A more-than-2% cost still needs the acknowledgement checkbox, with
  private-specific wording.
- **No halts.** Mimir halts stop THORChain and Maya, not Houdini; the halt banner and the greyed-out assets only apply on the other tabs.
- **XRP sells by deposit address only; a memo for exchange destinations.** A Houdini XRP deposit is identified by the destination tag Houdini
  assigns (the committed route's `memo`, from the execution's `attachment`), and the SDK's XRP toolbox only carries free-text memos, so an XRP
  deposit is never signed in-app: on the PRIVATE tab the swap button opens the deposit flow even with a wallet connected
  (`isDepositOnlyPrivateSell`), `executeRoute` refuses a destination-tag deposit on any other path, and the
  deposit screen shows the tag as required behind a confirmation checkbox. For wallets with no tag field (OKX Wallet's XRP send) it also shows the
  X-address (XLS-5d, `toXrpXAddress`) — the deposit address with the tag folded in — and the aggregator's QR encodes that X-address, so a
  scanned deposit is either tagged or rejected as an invalid address, never paid untagged. The Send dialog's Private Send leaves XRP out. Buying works to any
  address: when the buy chain is one Houdini marks
  `memoNeeded` (Cosmos, XRP, THORChain, TON — `supportsHoudiniMemo` in `src/lib/swap-helpers.ts`), `SwapRecipient` offers one optional
  _Memo/Tag/Comment_ field: free text up to 64 characters, except on XRP, where it must be a numeric destination tag (0–4294967295) —
  Houdini refuses a text tag when it creates the order ("Unable to perform exchange, no available paths"). It goes to the aggregator as
  `destinationMemo`, which hands it to Houdini as the order's `destinationTag`, and the confirm screen shows it. The aggregator takes a
  `destinationMemo` only on a preview whose `provider` is `HOUDINI_PRIVATE`. The Send dialog's Private Send tab offers the same field under its
  recipient address (`send.tsx`, passed through `privateSendQuote`).
- **Private send (Send mode).** Houdini routes an asset to itself (BTC → BTC to an unlinked address), a sizeable share of private
  volume. The tab opens with a _Swap | Send_ switch (`SwapPrivateMode`, `isPrivateSend` in `src/store/limit-swap-store.ts`) so users find it
  without having to pick one token twice. In Send mode the buy side follows the sell side (`setAssetFrom` / `setAssetTo` in
  `src/store/swap-store.ts` set both), the flip arrow and the buy-side asset picker are hidden, and the inputs read _Send_ / _Recipient Gets_. A same-asset pair exists only
  in Send mode: in the tab's Swap mode picking the other side's asset switches Send on (a same-asset pair *is* a private send), on the
  other tabs it flips the pair, and leaving Send (or the tab) restores a distinct buy asset — the
  effect in `swap.tsx` also corrects a same-asset pair rehydrated from storage. The `/sell-<asset>-buy-<asset>` URL is never
  rewritten to a same-asset pair (`useUrlParams`): Send mode is not in the URL (only the tab is, as `?private=true`), so it keeps the last real pair, and leaving Send restores
  that buy asset (`urlBuyAsset`).
  On the aggregator a same-asset pair is a private send, which only `HOUDINI_PRIVATE` serves; the app labels it _Send_ /
  _Confirm Private Send_ (`isPrivateSend` in `src/lib/swap-helpers.ts`). Not every private-swap asset can be sent privately — Houdini needs at
  least two venues for it — and one that cannot comes back as a quote error rather than being hidden from the list.
  Without a wallet, a private send asks for the receiving address only, like Houdini's own Send tab: a floating order needs no refund
  address, so a failed send is recovered through Houdini support (the order page) rather than refunded automatically. With a wallet the
  source address is still passed as the refund address. The aggregator then only picks routes that can do without one; when every route
  needs one it answers "needs a refund address", and `SwapRecipient` shows the refund field for the retry.
- **Private Send in the wallet Send dialog.** The Send dialog (`src/components/send/send.tsx`, opened from the wallet sidebar) has
  _Send | Private Send_ tabs. Private Send is the same same-asset Houdini order as the swap form's Send mode (`src/components/send/send-private.ts`):
  the token picker offers only tokens on the private rail's list, the amount gets an indicative quote (`/v3/rate`; _Recipient Gets_, estimated
  time), and _Send Privately_ previews the order (the sending wallet as refund address), commits it and pays its deposit. The deposit is a plain
  transfer signed through `uSwap.getWallet(account.provider, chain)` — the SDK's own `transfer` would use whichever wallet connected the chain
  last, not the account the dialog is sending from. The transaction is recorded like a swap-form private send, so history and tracking treat both the same; the
  disclaimer acknowledgement is shared with the PRIVATE tab.
- **Deposit memos.** When the order needs a deposit memo (ATOM, TON, RUNE to a venue that uses one) it arrives at commit as the execution's
  `attachment` (folded into `route.memo`), is stored on the
  transaction as `depositMemo`, and is shown beside the QR code — which then encodes the bare address, as it does for any token deposit, since a
  payment URI cannot carry a memo and would read a token amount as native coin.
- **Tracking.** Houdini watches the deposit itself, so the app never expires a Houdini order on its local clock; it becomes *Expired* when Houdini
  says so, or when Houdini no longer knows the order (48h) and never saw a deposit.
- **Chains.** The PRIVATE tab offers every asset the catalog tags with `HOUDINI_PRIVATE` on a chain the SDK knows; there is no chain list of
  its own. A chain the SDK does not know (Monero, Algorand, …) is dropped with the rest of the catalog's unknown chains, and one without a
  `public/networks/<chain>.svg` shows a broken badge until the icon is added.
- **Fees.** The aggregator charges its configured Houdini service/affiliate bps through Houdini's partner markup and reports them in the
  route's `fees`.
