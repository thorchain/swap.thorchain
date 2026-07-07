import { AppConfig } from '@/config'

export function GET() {
  const catalog = {
    linkset: [
      {
        anchor: `${AppConfig.baseUrl}/api/newsletter`,
        'service-desc': [
          {
            href: `${AppConfig.baseUrl}/.well-known/openapi.json`,
            type: 'application/vnd.oai.openapi+json'
          }
        ],
        'service-doc': [
          {
            href: `${AppConfig.baseUrl}/auth.md`,
            type: 'text/markdown'
          }
        ],
        status: [
          {
            href: `${AppConfig.baseUrl}/.well-known/status`,
            type: 'application/json'
          }
        ]
      },
      {
        anchor: `${AppConfig.baseUrl}/api/report-bug`,
        'service-desc': [
          {
            href: `${AppConfig.baseUrl}/.well-known/openapi.json`,
            type: 'application/vnd.oai.openapi+json'
          }
        ],
        'service-doc': [
          {
            href: `${AppConfig.baseUrl}/auth.md`,
            type: 'text/markdown'
          }
        ],
        status: [
          {
            href: `${AppConfig.baseUrl}/.well-known/status`,
            type: 'application/json'
          }
        ]
      }
    ]
  }

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      'Content-Type': 'application/linkset+json; charset=utf-8'
    }
  })
}
