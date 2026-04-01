import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemo } from '@/components/send-memo/send-memo'

export const metadata: Metadata = {
  title: 'Memo | THORChain'
}

export default function MemoPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-lg px-4 py-12 ">
        <Suspense>
          <SendMemo />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
