# Cosmos Signer

Most of the contents of this directory are vendored from the following repositories. The origins are published to NPM with legacy tendermint support, wallet creation features depending on eg libsodium, and compiled with CommonJS. This makes the dependency very large. Vendoring this code allows us to make more rapid changes to clients, and significantly reduce bundle sizes.

- https://github.com/cosmos/cosmjs
- https://github.com/confio/cosmjs-types
