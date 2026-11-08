import Decimal from 'decimal.js'
import type { Chain } from '@tcswap/core'
import type { Asset } from '@/components/swap/asset'

interface GraphqlAsset {
  asset: string
  type: string
  chain: string
  metadata: { symbol: string; decimals: number; name: string | null; pngUrl: string | null }
  variants?: { layer1: GraphqlAsset | null }
}

export interface BorrowMarketsData {
  ghostCredit: {
    adjustmentThreshold: string
    liquidationThreshold: string
    collaterals: { ratio: string; price: { current: string } | null; asset: GraphqlAsset }[]
    vaults: {
      price: { current: string } | null
      borrower: {
        asset: GraphqlAsset
        vault: {
          interest: { baseRate: string; step1: string; step2: string; targetUtilization: string }
          status: { debtRate: string; depositPool: { size: string }; debtPool: { size: string } }
        }
      }
    }[]
  } | null
}

export interface BorrowInterest {
  baseRate: string
  step1: string
  step2: string
  targetUtilization: string
  totalDeposits: string
  totalDebt: string
}

export interface BorrowAsset extends Asset {
  // The collateral/vault identity stays distinct from its external deposit/payout asset.
  marketId: string
  usdPrice: string | null
  collateralRatio?: string
  borrowRate?: string
  interest?: BorrowInterest
}

export interface BorrowMarkets {
  adjustmentThreshold: string
  liquidationThreshold: string
  depositAssets: BorrowAsset[]
  borrowAssets: BorrowAsset[]
}

const toAsset = (source: GraphqlAsset, price: { current: string } | null): BorrowAsset => {
  const asset = source.variants?.layer1 ?? source
  return {
    marketId: source.asset,
    identifier: asset.asset,
    chain: asset.chain as Chain,
    chainId: asset.chain,
    ticker: asset.metadata.symbol,
    decimals: asset.metadata.decimals,
    name: asset.metadata.name ?? undefined,
    logoURI: asset.metadata.pngUrl ?? undefined,
    isSecuredAsset: asset.type === 'SECURED' || undefined,
    providers: [],
    usdPrice: price ? new Decimal(price.current).div('1000000000000').toFixed() : null
  }
}

const uniqueSorted = (assets: BorrowAsset[]) =>
  Array.from(new Map(assets.map(asset => [asset.identifier, asset])).values()).sort((a, b) => a.ticker.localeCompare(b.ticker))

export const getBorrowMarkets = (data: BorrowMarketsData): BorrowMarkets => {
  if (!data.ghostCredit) throw new Error('Borrow markets are unavailable')
  const scaled = (value: string) => new Decimal(value).div('1000000000000').toFixed()
  return {
    adjustmentThreshold: scaled(data.ghostCredit.adjustmentThreshold),
    liquidationThreshold: scaled(data.ghostCredit.liquidationThreshold),
    depositAssets: uniqueSorted(
      data.ghostCredit.collaterals
        .filter(collateral => BigInt(collateral.ratio) > 0n)
        .map(c => ({
          ...toAsset(c.asset, c.price),
          collateralRatio: scaled(c.ratio)
        }))
    ),
    // Vault membership defines lendable assets; a temporarily empty vault remains listed.
    borrowAssets: uniqueSorted(
      data.ghostCredit.vaults.map(v => {
        const { interest, status } = v.borrower.vault
        // Pools use the secured market's decimals, which can differ from the Layer 1 display asset.
        const units = new Decimal(10).pow(v.borrower.asset.metadata.decimals)
        return {
          ...toAsset(v.borrower.asset, v.price),
          borrowRate: scaled(status.debtRate),
          interest: {
            baseRate: scaled(interest.baseRate),
            step1: scaled(interest.step1),
            step2: scaled(interest.step2),
            targetUtilization: scaled(interest.targetUtilization),
            totalDeposits: new Decimal(status.depositPool.size).div(units).toFixed(),
            totalDebt: new Decimal(status.debtPool.size).div(units).toFixed()
          }
        }
      })
    )
  }
}
