import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { SUBDOMAIN_ROUTES } from '@/config'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const discoveryLinks = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
  '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"'
].join(', ')

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Link',
            value: discoveryLinks
          }
        ]
      }
    ]
  },
  async rewrites() {
    return {
      beforeFiles: SUBDOMAIN_ROUTES.map(({ host, path }) => ({
        source: '/',
        has: [{ type: 'host', value: host }],
        destination: path
      })),
      afterFiles: [],
      fallback: []
    }
  }
}

export default withNextIntl(nextConfig)
