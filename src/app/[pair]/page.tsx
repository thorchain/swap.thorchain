import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SwapPage } from '@/app/components/swap-page'
import { AppConfig } from '@/config'

const PAIR_PATTERN = /^sell-.+-buy-.+$/

type PairPageProps = { params: Promise<{ pair: string }> }

export async function generateMetadata({ params }: PairPageProps): Promise<Metadata> {
  const { pair } = await params
  if (!PAIR_PATTERN.test(pair)) return {}

  return {
    alternates: {
      canonical: `${AppConfig.baseUrl}/${encodeURIComponent(pair)}`
    }
  }
}

export default async function Page({ params }: PairPageProps) {
  const { pair } = await params
  if (!PAIR_PATTERN.test(pair)) notFound()
  return <SwapPage />
}
