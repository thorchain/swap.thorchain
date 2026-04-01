import { useQueries } from '@tanstack/react-query'
import { Chain } from '@tcswap/core'
import { getTcyClaimer, TcyClaimer } from '@/lib/api'
import { WalletAccount } from '@/store/wallets-store'

const ASSET_CHAIN_MAP: Record<string, Chain> = {
  'ETH.': Chain.Ethereum,
  'AVAX.': Chain.Avalanche,
  'BTC.': Chain.Bitcoin,
  'DOGE.': Chain.Dogecoin,
  'LTC.': Chain.Litecoin,
  'GAIA.': Chain.Cosmos,
  'XRP.': Chain.Ripple,
  'SOL.': Chain.Solana,
  'BSC.': Chain.Ethereum,
}

function chainFromAsset(asset: string): Chain | undefined {
  for (const [prefix, chain] of Object.entries(ASSET_CHAIN_MAP)) {
    if (asset.startsWith(prefix)) return chain
  }
}

export interface TcyClaimEntry {
  account: WalletAccount
  claimer: TcyClaimer
  tcyAmount: number
}

export const useTcyClaimer = (accounts: WalletAccount[]) => {
  const l1Accounts = accounts.filter(a => a.network !== Chain.THORChain && a.network !== Chain.Maya)

  const results = useQueries({
    queries: l1Accounts.map(account => ({
      queryKey: ['tcy-claimer', account.address],
      queryFn: () => getTcyClaimer(account.address),
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false
    }))
  })

  const entries: TcyClaimEntry[] = []
  results.forEach((result, i) => {
    const account = l1Accounts[i]
    if (!result.data) return
    for (const claimer of result.data) {
      const chain = chainFromAsset(claimer.asset)
      if (chain === account.network) {
        entries.push({ account, claimer, tcyAmount: parseInt(claimer.amount) / 1e8 })
      }
    }
  })

  const isLoading = results.some(r => r.isLoading)
  const totalClaimable = entries.reduce((sum, e) => sum + e.tcyAmount, 0)

  return { entries, totalClaimable, isLoading }
}
