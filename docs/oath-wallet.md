# Oath Wallet via WalletConnect

Oath is a native iOS wallet. Its main Connect Wallet entry uses the existing `@tcswap/wallets/walletconnect` connector, not an injected browser
provider.

## User flow

- Oath Wallet appears alongside the other wallets whenever the existing `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is configured.
- On desktop, selecting Oath immediately shows its branded WalletConnect QR and scanning instructions. There is no intervening generic wallet chooser.
- On iOS, the same entry presents the WalletConnect mobile handoff to `oathwallet://wc?uri=...`, with the modal's retry and App Store fallback.
- An existing visible WalletConnect connection requires the user to choose **Disconnect and connect Oath** first. An orphan SDK session is ended
  before a fresh pairing, rather than silently attributing another wallet to Oath.
- Accounts remain `WalletOption.WALLETCONNECT`, preserving the existing signing, restore, disconnect, and account-management paths. The account
  sidebar continues to identify the transport as WalletConnect; peer names are not authentication.

The requested chains are the intersection of Oath's WalletConnect signing support and this SDK connector: Arbitrum, Avalanche, Base, BNB Smart Chain,
Ethereum, and THORChain. Wallet-held assets do not imply WalletConnect signing support. In particular, this entry does not advertise Bitcoin or Solana
through this connector. An active chain filter restricts the request to that supported chain.

## Integration details

`src/lib/oath-walletconnect.ts` temporarily selects the Oath route through the public exports of `@walletconnect/modal-core` 2.7.0. The SDK still
creates the SignClient, owns the real pairing URI, and handles approval, rejection, cancellation, and session cleanup. No second client, synthetic QR,
or URI persistence is added. All WalletConnect calls are serialized so another connection cannot inherit the Oath presentation. Subscriptions,
branding, and routing are reset on completion or failure. Recheck this contract when upgrading the SDK/modal packages.

The `oath-ios` identifier is local UI metadata, not a WalletGuide directory ID or an assertion of directory approval. The SVG preserves Oath's white
mark and blue background, with the same 25% corner radius as the existing WalletConnect SVG.

- Website: https://oathwallet.org
- iOS download: https://apps.apple.com/app/id6780187283
- Native link: `oathwallet://`
- Universal link: `https://oathwallet.org`

## Review and validation

Run `npm run test:oath-wallet`, `npx tsc --noEmit -p tsconfig.json`, `npm run test:i18n`, and `npm run build`.

With a configured project ID, open Wallet → Connect Wallet:

1. Confirm Oath appears directly with its logo and “iPhone · WalletConnect”.
2. Select Oath. Confirm an Oath-branded QR appears without selecting WalletConnect.
3. Close it, then use the generic WalletConnect entry. Confirm its regular chooser returns with no Oath branding.
4. Filter by THORChain and repeat. Unsupported chains must disable Oath.
5. With an existing WalletConnect session, confirm replacement is explicit.
6. On an iPhone with Oath installed, confirm the mobile link opens Oath, approve the connection, and verify the approved accounts. Test signing
   separately with a disposable wallet; connection alone does not prove a completed swap.

The local browser check confirmed the main entry, a real relay-generated QR, the generic chooser after Oath, and chain filtering (Bitcoin disables Oath;
THORChain enables it). Oath's current source handles the
native WC URI and Cosmos signing methods. Targeted Oath host tests passed (three tests; one optional isolated-THORNode test skipped). The wallet team
also supplied screenshots of an iPhone connection to the production generic WC entry. A fresh physical-iPhone pairing from this new entry and an
end-to-end swap were not run as part of this PR. Merge/deployment remains with the THORChain maintainers.
