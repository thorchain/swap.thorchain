import { PropsWithChildren } from 'react'
import { AccountsProvider } from '@/context/accounts-provider'

export function Providers({ children }: PropsWithChildren) {
  return <AccountsProvider>{children}</AccountsProvider>
}
