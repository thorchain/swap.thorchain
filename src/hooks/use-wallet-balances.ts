import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AssetValue, USwapNumber } from '@tcswap/core'
import { useRates } from '@/hooks/use-rates'
import { useAccounts } from '@/hooks/use-wallets'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'

function assetIdentifier(b: AssetValue): string {
  return `${b.chain}.${b.isSynthetic || b.isTradeAsset ? b.ticker : b.symbol}`
}

export interface TokenBalance {
  balance: AssetValue
  amount: number
  usdValue?: USwapNumber
}

export interface ChainWalletData {
  account: WalletAccount
  tokens: TokenBalance[]
  totalUsd?: USwapNumber
  isLoading: boolean
}

export const useWalletBalances = () => {
  const accounts = useAccounts()
  const uSwap = getUSwap()

  const queryKey = accounts.map(a => `${a.provider}-${a.network}`).join(',')

  const { data: allBalances, isLoading } = useQuery({
    queryKey: ['wallet-all-balances', queryKey],
    queryFn: async () => {
      const results = await Promise.allSettled(
        accounts.map(async account => {
          const wallet = uSwap.getWallet(account.provider, account.network)
          if (!wallet || !('getBalance' in wallet)) return { account, balances: [] as AssetValue[] }
          const balances: AssetValue[] = await (wallet as any).getBalance(wallet.address)
          return { account, balances: balances || [] }
        })
      )
      return results.map((r, i) => ({
        account: accounts[i],
        balances: r.status === 'fulfilled' ? r.value.balances : ([] as AssetValue[])
      }))
    },
    enabled: accounts.length > 0,
    staleTime: 30_000,
    retry: false,
    refetchOnMount: false
  })

  const tokenIdentifiers = useMemo(() => {
    if (!allBalances) return []
    const ids = new Set<string>()
    for (const { balances } of allBalances) {
      for (const b of balances) {
        ids.add(assetIdentifier(b))
      }
    }
    return Array.from(ids)
  }, [allBalances])

  const { rates } = useRates(tokenIdentifiers)

  const walletData: ChainWalletData[] = useMemo(() => {
    if (!allBalances) {
      return accounts.map(account => ({ account, tokens: [], totalUsd: undefined, isLoading: true }))
    }

    return allBalances.map(({ account, balances }) => {
      const tokens: TokenBalance[] = balances.map(b => {
        const rate = rates[assetIdentifier(b)]
        const amount = parseFloat(b.toSignificant())
        const usdValue = rate ? rate.mul(amount) : undefined
        return { balance: b, amount, usdValue }
      })

      const allPriced = tokens.length > 0 && tokens.every(t => t.usdValue !== undefined)
      const totalUsd = allPriced ? tokens.slice(1).reduce((sum, t) => sum.add(t.usdValue!), tokens[0].usdValue!) : undefined

      return { account, tokens, totalUsd, isLoading: false }
    })
  }, [allBalances, rates, accounts])

  return { walletData, isLoading }
}
