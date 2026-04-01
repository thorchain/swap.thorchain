import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemoBond } from '@/components/send-memo/send-memo-bond'

export const metadata: Metadata = {
  title: 'Bond | THORChain'
}

export default function BondPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-lg px-4 py-12">
        <Suspense>
          <SendMemoBond />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
