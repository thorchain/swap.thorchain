import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { Thorname } from '@/components/send-memo/thorname/thorname'

export const metadata: Metadata = {
  title: 'THORName | THORChain'
}

export default function ThornamePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Suspense>
          <Thorname />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
