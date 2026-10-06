import { Chain, UTXOChain } from '@tcswap/core'

// Blockchair's slug per UTXO chain, as the toolbox derives them; the proxy allowlists exactly these.
export const BLOCKCHAIR_CHAINS: Partial<Record<UTXOChain, string>> = {
  [Chain.Bitcoin]: 'bitcoin',
  [Chain.BitcoinCash]: 'bitcoin-cash',
  [Chain.Litecoin]: 'litecoin',
  [Chain.Dash]: 'dash',
  [Chain.Dogecoin]: 'dogecoin',
  [Chain.Zcash]: 'zcash'
}
