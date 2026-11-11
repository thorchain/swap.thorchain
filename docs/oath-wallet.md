# Oath Wallet

Select **Oath Wallet** in the Mobile group to pair through WalletConnect. Open Oath on iOS or scan the QR with Oath on another device. The app asks for the selected network or the supported intersection of Arbitrum, Avalanche C-Chain, Base, BNB Smart Chain, Ethereum and THORChain. Accounts use the existing WalletConnect provider for signing, restoration and disconnection.

The selector requires the TCSwap wallets release that exports `oathWalletconnectTarget` and accepts `targetWallet`. Update the dependency and lockfile once that release is published. The SDK owns the pairing URI, modal, queue and session lifecycle.

## Review

- Run `npm run test:oath-wallet`, `npm run test:i18n`, `npx tsc --noEmit -p tsconfig.json` and `npm run build`.
- With a WalletConnect project ID configured, select Oath directly. Close the QR and open generic WalletConnect. Check that its regular selector returns and prior sessions survive cancellation.
- With an iPhone, start a fresh pairing from the **Oath Wallet** entry. Verify the app receives the proposal, approve it and check the selected account on the website.
- Before listing, verify a supported swap through that session on the iPhone. Record the app version, input/output networks, and confirmed result. Do not include pairing URIs or private wallet details.
