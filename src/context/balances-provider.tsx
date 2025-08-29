'use client'

import { createContext, FC, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react'
import { Network } from 'rujira.js'
import { BalanceFetcher } from '@/wallets/balances'
import { usePools } from '@/hook/use-pools'
import { useAccounts } from '@/context/accounts-provider'

interface BalancesContext {
  balances: Record<string, string>
  refresh: (network: Network, address: string, assets: string[]) => void
}

const Context = createContext<BalancesContext>({
  balances: {},
  refresh: () => null
})

export const BalancesProvider: FC<PropsWithChildren> = ({ children }) => {
  const { pools } = usePools()
  const { wallets } = useAccounts()
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [synced, setSynced] = useState<Record<string, boolean>>({})

  const refresh = useCallback(
    (network: Network, address: string, assets: string[]) => {
      if (synced[`${network}:${address}`]) return

      BalanceFetcher.fetch({ network, address, assets }).then(result => {
        setBalances(prev => ({ ...prev, ...result }))
        setSynced(prev => ({ ...prev, [`${network}:${address}`]: true }))
      })
    },
    [synced]
  )

  useEffect(() => {
    if (!pools?.length || !wallets?.length) return

    wallets.forEach(wallet => {
      const assets = pools.filter(p => p.chain === wallet.account.network).map(i => i.asset)
      refresh(wallet.account.network, wallet.account.address, assets)
    })
  }, [pools, wallets, refresh])

  return <Context.Provider value={{ balances, refresh }}>{children}</Context.Provider>
}

export const useBalances = (): BalancesContext => useContext(Context)
