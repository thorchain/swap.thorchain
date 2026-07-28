import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemoStake } from '@/components/send-memo/send-memo-stake'
import { buildPageMetadata } from '@/lib/page-metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'TCY Token: Stake & Earn RUNE Rewards | THORChain',
  description:
    'TCY holders earn a share of THORChain protocol income, paid daily in RUNE. Claim, stake, or trade TCY directly from your crypto wallet.'
})

export default function TcyPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Suspense>
          <SendMemoStake />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
