import { NextRequest, NextResponse } from 'next/server'
import { AppConfig, PRIMARY_HOST, SUBDOMAIN_ROUTES } from '@/config'

const homeMarkdown = `# THORChain Swap

THORChain Swap is the public swap interface for THORChain powered cross-chain swaps.

## Public Pages

- [Swap interface](${AppConfig.baseUrl}/)
- [Pool interface](https://pool.thorchain.org/)
- [Bond interface](https://bond.thorchain.org/)
- [Memo interface](https://memo.thorchain.org/)
- [TCY interface](https://tcy.thorchain.org/)
- [THORName interface](https://thorname.thorchain.org/)

## Machine-Readable Discovery

- [robots.txt](${AppConfig.baseUrl}/robots.txt)
- [sitemap.xml](${AppConfig.baseUrl}/sitemap.xml)
- [API catalog](${AppConfig.baseUrl}/.well-known/api-catalog)
- [OpenAPI description](${AppConfig.baseUrl}/.well-known/openapi.json)
- [Agent skills index](${AppConfig.baseUrl}/.well-known/agent-skills/index.json)
- [Auth.md](${AppConfig.baseUrl}/auth.md)
`

function acceptsMarkdown(req: NextRequest) {
  return req.headers.get('accept')?.toLowerCase().includes('text/markdown') ?? false
}

export function proxy(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0]
  if (!host.endsWith('.thorchain.org')) return NextResponse.next()

  const { pathname, search } = req.nextUrl

  if (host === PRIMARY_HOST && pathname === '/' && acceptsMarkdown(req)) {
    return new NextResponse(homeMarkdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'x-markdown-tokens': String(Math.ceil(homeMarkdown.split(/\s+/).length * 1.35))
      }
    })
  }

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
