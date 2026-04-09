import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AssetValue, Chain, USwapNumber } from '@tcswap/core'
import { useAssets } from '@/hooks/use-assets'
import { useRates } from '@/hooks/use-rates'
import { useAccounts, useHasHydrated } from '@/hooks/use-wallets'
import { getAlchemyTokenBalances } from '@/lib/api'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'

const ETH_RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_ETH_RPC_URL || 'https://eth.llamarpc.com'

function assetIdentifier(b: AssetValue): string {
  const identifier = b.isSynthetic || b.isTradeAsset ? b.ticker : b.address ? `${b.ticker}-${b.address}` : b.ticker
  return `${b.chain}.${identifier}`
}

export interface TokenBalance {
  balance: AssetValue
  amount: number
  usdValue?: USwapNumber
  logoURI?: string
}

export interface ChainWalletData {
  account: WalletAccount
  tokens: TokenBalance[]
  totalUsd?: USwapNumber
  isLoading: boolean
}

export const useWalletBalances = () => {
  const { assets } = useAssets()
  const accounts = useAccounts()
  const hasHydrated = useHasHydrated()
  const uSwap = getUSwap()

  const iconMap = useMemo(() => {
    if (!assets) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const asset of assets) {
      if (asset.logoURI) {
        map.set(`${asset.identifier}`.toLowerCase(), asset.logoURI)
      }
    }
    return map
  }, [assets])

  const queryKey = accounts.map(a => `${a.provider}-${a.network}`).join(',')

  const { data: allBalances, isLoading } = useQuery({
    queryKey: ['wallet-all-balances', queryKey],
    queryFn: async () => {
      const results = await Promise.allSettled(
        accounts.map(async account => {
          const wallet = uSwap.getWallet(account.provider, account.network)
          if (!wallet || !('getBalance' in wallet)) return { account, balances: [] as AssetValue[] }
          const rawBalances = await (wallet as any).getBalance(wallet.address, false)
          const balances: AssetValue[] = rawBalances ? [...rawBalances] : []

          // For Ethereum, supplement with Alchemy to discover meme coins not in the curated API list
          if (account.network === Chain.Ethereum) {
            const alchemyBalances = await getAlchemyTokenBalances(wallet.address, ETH_RPC_URL)
            const existingAddresses = new Set(
              balances.map(b => b.address?.toLowerCase()).filter(Boolean)
            )
            for (const t of alchemyBalances) {
              const addr = t.contractAddress.toLowerCase()
              if (existingAddresses.has(addr)) continue
              const value = BigInt(t.tokenBalance).toString()
              try {
                const av = AssetValue.from({
                  asset: `ETH.${t.symbol}-${t.contractAddress}`,
                  fromBaseDecimal: t.decimals,
                  value
                })
                balances.push(av)
              } catch {
                // skip tokens that can't be parsed
              }
            }
          }

          return { account, balances }
        })
      )
      return results.map((r, i) => ({
        account: accounts[i],
        balances: r.status === 'fulfilled' ? r.value.balances : ([] as AssetValue[])
      }))
    },
    enabled: accounts.length > 0 && hasHydrated,
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
      const tokens: TokenBalance[] = balances.filter(b => b.ticker && b.ticker.toLowerCase() !== 'unknown').map(b => {
        const rate = rates[assetIdentifier(b)]
        const amount = parseFloat(b.toSignificant())
        const usdValue = rate ? rate.mul(amount) : undefined
        const key = `${assetIdentifier(b)}`.toLowerCase()
        const logoURI = iconMap.get(key)
        return { balance: b, amount, usdValue, logoURI }
      })

      const pricedTokens = tokens.filter(t => t.usdValue !== undefined)
      const totalUsd = pricedTokens.length > 0 ? pricedTokens.slice(1).reduce((sum, t) => sum.add(t.usdValue!), pricedTokens[0].usdValue!) : undefined

      return { account, tokens, totalUsd, isLoading: false }
    })
  }, [allBalances, rates, accounts, iconMap])

  return { walletData, isLoading }
}
