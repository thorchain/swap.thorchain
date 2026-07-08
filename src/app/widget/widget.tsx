'use client'

import { Suspense } from 'react'
import { GlobalDialog } from '@/components/global-dialog'
import { Swap } from '@/components/swap/swap'
import { setUSwapApiKey } from '@/lib/wallets'

export function Widget({ apiKey }: { apiKey?: string }) {
  if (apiKey) setUSwapApiKey(apiKey)

  return (
    <main className="flex min-h-screen flex-col justify-center">
      <Suspense>
        <Swap />
      </Suspense>
      <GlobalDialog />
    </main>
  )
}
