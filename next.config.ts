import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { SUBDOMAIN_ROUTES } from '@/config'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
const nextConfig: NextConfig = {
  output: 'standalone',
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
