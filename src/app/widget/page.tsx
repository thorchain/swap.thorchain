import type { Metadata } from 'next'
import { Widget } from './widget'

export const metadata: Metadata = {
  title: 'Swap Widget | THORChain',
  robots: { index: false }
}

interface WidgetPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function WidgetPage({ searchParams }: WidgetPageProps) {
  const params = await searchParams
  const apiKey = typeof params.apiKey === 'string' ? params.apiKey : undefined

  return <Widget apiKey={apiKey} />
}
