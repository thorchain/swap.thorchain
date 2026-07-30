import type { Metadata } from 'next'
import { SwapPage } from '@/app/components/swap-page'
import { AppConfig } from '@/config'

export const metadata: Metadata = {
  alternates: {
    canonical: AppConfig.baseUrl
  }
}

export default async function Page() {
  return <SwapPage />
}
