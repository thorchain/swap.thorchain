import { NextRequest, NextResponse } from 'next/server'

const SUBDOMAIN_ROUTES = [
  { path: '/tcy', host: 'tcy.thorchain.org' },
  { path: '/bond', host: 'bond.thorchain.org' },
  { path: '/memo', host: 'memo.thorchain.org' }
]

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0]
  if (!host.endsWith('.thorchain.org')) return NextResponse.next()

  const { pathname, search } = req.nextUrl
  for (const route of SUBDOMAIN_ROUTES) {
    if (pathname === route.path || pathname.startsWith(route.path + '/')) {
      return NextResponse.redirect(`https://${route.host}/${search}`)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/tcy/:path*', '/bond/:path*', '/memo/:path*']
}
