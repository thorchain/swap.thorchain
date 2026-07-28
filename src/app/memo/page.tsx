import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { SendMemo } from '@/components/send-memo/send-memo'
import { buildPageMetadata } from '@/lib/page-metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Memo Tool: Build Custom Memos | THORChain',
  description:
    'Create a custom THORChain memo for any transaction such as swaps, adding liquidity, withdrawals. Fill in the details and use it with your self-custody wallet.'
})

export default function MemoPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto max-w-xl px-4 py-12">
        <Suspense>
          <SendMemo />
        </Suspense>
      </div>
      <GlobalDialog />
      <Footer />
    </main>
  )
}
