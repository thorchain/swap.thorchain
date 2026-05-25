import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const SUBDOMAIN_ROUTES = [
  { host: 'tcy.thorchain.org', destination: '/tcy' },
  { host: 'bond.thorchain.org', destination: '/bond' },
  { host: 'memo.thorchain.org', destination: '/memo' }
]

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return {
      beforeFiles: SUBDOMAIN_ROUTES.map(({ host, destination }) => ({
        source: '/',
        has: [{ type: 'host', value: host }],
        destination
      })),
      afterFiles: [],
      fallback: []
    }
  }
}

export default withNextIntl(nextConfig)
