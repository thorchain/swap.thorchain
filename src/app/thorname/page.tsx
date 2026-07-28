import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { Thorname } from '@/components/send-memo/thorname/thorname'
import { buildPageMetadata } from '@/lib/page-metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'THORName: Register Your Address | THORChain',
  description:
    "Replace long wallet addresses with a simple THORName that's easier to remember and share. You can also manage addresses and receive affiliate payouts."
})

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
