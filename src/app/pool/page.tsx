import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemoPool } from '@/components/send-memo/send-memo-pool'

export const metadata: Metadata = {
  title: 'Pool | THORChain'
}

export default function PoolPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Suspense>
          <SendMemoPool />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
