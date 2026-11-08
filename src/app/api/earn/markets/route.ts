import { NextResponse } from 'next/server'
import { fetchEarnMarkets } from '@/lib/rujira/earn-client'
import { RujiraDataError } from '@/lib/rujira/client'

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get('mode')
  if (mode !== 'automated' && mode !== 'lending' && mode !== 'staking') return NextResponse.json({ error: 'Invalid Earn mode' }, { status: 400 })
  try {
    return NextResponse.json(await fetchEarnMarkets(mode), { headers: { 'cache-control': 'public, max-age=60' } })
  } catch (error) {
    console.error('Unable to load Rujira Earn markets', error)
    const rateLimited = error instanceof RujiraDataError && error.code === 'rate_limited'
    return NextResponse.json({ error: 'Earn data is unavailable' }, { status: rateLimited ? 503 : 502, headers: { 'cache-control': 'no-store' } })
  }
}
