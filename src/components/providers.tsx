import { PropsWithChildren } from 'react'
import { AccountsProvider } from '@/context/accounts-provider'
import { ReactQueryProvider } from '@/context/react-query-provider'
import { SwapProvider } from '@/context/swap-provider'
import { BalancesProvider } from '@/context/balances-provider'

export function Providers({ children }: PropsWithChildren) {
  return (
    <ReactQueryProvider>
      <SwapProvider>
        <AccountsProvider>
          <BalancesProvider>{children}</BalancesProvider>
        </AccountsProvider>
      </SwapProvider>
    </ReactQueryProvider>
  )
}
