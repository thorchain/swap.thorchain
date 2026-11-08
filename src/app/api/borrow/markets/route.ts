import { NextResponse } from 'next/server'
import { fetchBorrowMarkets, RujiraDataError } from '@/lib/rujira/client'

export async function GET() {
  try {
    return NextResponse.json(await fetchBorrowMarkets(), { headers: { 'cache-control': 'public, max-age=30' } })
  } catch (error) {
    console.error('Unable to load Rujira borrow markets', error)
    const code = error instanceof RujiraDataError ? error.code : 'upstream'
    return NextResponse.json(
      { error: 'Borrow markets are temporarily unavailable', code },
      {
        status: code === 'rate_limited' ? 503 : 502,
        headers: { 'cache-control': 'no-store', ...(code === 'rate_limited' ? { 'retry-after': '10' } : {}) }
      }
    )
  }
}
