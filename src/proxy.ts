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

- [llms.txt](${AppConfig.baseUrl}/llms.txt)
- [AGENTS.md](${AppConfig.baseUrl}/AGENTS.md)
- [MCP server card](${AppConfig.baseUrl}/.well-known/mcp-server-card)
- [robots.txt](${AppConfig.baseUrl}/robots.txt)
- [sitemap.xml](${AppConfig.baseUrl}/sitemap.xml)
- [API catalog](${AppConfig.baseUrl}/.well-known/api-catalog)
- [OpenAPI description](${AppConfig.baseUrl}/.well-known/openapi.json)
- [Agent skills index](${AppConfig.baseUrl}/.well-known/agent-skills/index.json)
- [Auth.md](${AppConfig.baseUrl}/auth.md)
`

function prefersMarkdown(req: NextRequest) {
  const accept = req.headers.get('accept')?.toLowerCase()
  if (!accept || !accept.includes('text/markdown')) return false

  let markdownQ = 0
  let htmlQ = 0
  for (const entry of accept.split(',')) {
    const [type, ...params] = entry.split(';').map(part => part.trim())
    let q = 1
    for (const param of params) {
      if (param.startsWith('q=')) q = Number(param.slice(2)) || 0
    }
    if (type === 'text/markdown') markdownQ = Math.max(markdownQ, q)
    if (type === 'text/html') htmlQ = Math.max(htmlQ, q)
  }
  return markdownQ > 0 && markdownQ >= htmlQ
}

export function proxy(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0]
  if (!host.endsWith('.thorchain.org')) return NextResponse.next()

  const { pathname, search } = req.nextUrl

  if (host === PRIMARY_HOST && pathname === '/' && prefersMarkdown(req)) {
    // no-store: this URL serves HTML to browsers, and CDNs don't reliably
    // key their cache on Accept, so the markdown variant must never land
    // in a shared cache.
    return new NextResponse(homeMarkdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept',
        'Cache-Control': 'no-store',
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
