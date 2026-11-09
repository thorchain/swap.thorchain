import type { BorrowAsset } from './borrow-markets'

type LinkAsset = Pick<BorrowAsset, 'ticker' | 'chain' | 'isSecuredAsset'>

// Supported symbols whose canonical chain differs from their ticker.
const CANONICAL_CHAINS: Record<string, string> = { ATOM: 'GAIA', BNB: 'BSC', USDC: 'ETH', USDT: 'ETH' }

const assetSegment = ({ ticker, chain }: LinkAsset) =>
  encodeURIComponent(chain === 'THOR' || chain === (CANONICAL_CHAINS[ticker] ?? ticker) ? ticker : `${ticker}.${chain}`)

export const getBorrowUrl = (collateral?: LinkAsset, debt?: LinkAsset): string => {
  if (!collateral || !debt) return 'https://rujira.network/borrow'
  const url = new URL(`https://rujira.network/borrow/${assetSegment(collateral)}/${assetSegment(debt)}`)
  // Rujira uses toChain to distinguish an external payout from a secured asset.
  if (!debt.isSecuredAsset && debt.chain !== 'THOR') url.searchParams.set('toChain', debt.chain)
  return url.toString()
}
