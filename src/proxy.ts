import { NextRequest, NextResponse } from 'next/server'
import { PRIMARY_HOST, SUBDOMAIN_ROUTES } from '@/config'

export function proxy(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0]
  if (!host.endsWith('.thorchain.org')) return NextResponse.next()

  const { pathname, search } = req.nextUrl

  for (const route of SUBDOMAIN_ROUTES) {
    if (pathname === route.path || pathname.startsWith(route.path + '/')) {
      return NextResponse.redirect(`https://${route.host}/${search}`)
    }
  }

  const owner = SUBDOMAIN_ROUTES.find(r => r.host === host)
  if (owner && pathname !== '/' && !pathname.includes('.')) {
    return NextResponse.redirect(`https://${PRIMARY_HOST}${pathname}${search}`)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|api/).*)']
}
