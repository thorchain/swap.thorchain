import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemoBond } from '@/components/send-memo/send-memo-bond'
import { buildPageMetadata } from '@/lib/page-metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Bond RUNE to a Node | THORChain',
  description:
    'Bond RUNE to a THORChain node. Connect your wallet to add, top up, withdraw, and manage your bond position on-chain.'
})

export default function BondPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Suspense>
          <SendMemoBond />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
