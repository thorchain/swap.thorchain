import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemoStake } from '@/components/send-memo/send-memo-stake'

export const metadata: Metadata = {
  title: '$TCY Stake | THORChain'
}

export default function StakePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Suspense>
          <SendMemoStake />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
