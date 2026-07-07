import { AppConfig } from '@/config'

export function GET() {
  const openapi = {
    openapi: '3.1.0',
    info: {
      title: 'THORChain Swap Public API',
      version: '0.1.0',
      description: 'Public support endpoints exposed by the THORChain Swap web interface.'
    },
    servers: [{ url: AppConfig.baseUrl }],
    paths: {
      '/api/newsletter': {
        post: {
          summary: 'Subscribe an email address to THORChain Swap updates.',
          operationId: 'subscribeNewsletter',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' }
                  },
                  additionalProperties: false
                }
              }
            }
          },
          responses: {
            '200': { description: 'Subscription accepted.' },
            '400': { description: 'Invalid email address.' },
            '500': { description: 'Server misconfiguration or upstream provider error.' }
          }
        }
      },
      '/api/report-bug': {
        post: {
          summary: 'Submit a bug report or feature request.',
          operationId: 'reportBug',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['description'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    description: { type: 'string', minLength: 1 },
                    attachment: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        content: { type: 'string' }
                      },
                      additionalProperties: false
                    }
                  },
                  additionalProperties: false
                }
              }
            }
          },
          responses: {
            '200': { description: 'Report accepted.' },
            '400': { description: 'Missing or invalid description.' },
            '500': { description: 'Server misconfiguration or upstream provider error.' }
          }
        }
      },
      '/.well-known/status': {
        get: {
          summary: 'Return discovery endpoint status.',
          operationId: 'getDiscoveryStatus',
          responses: {
            '200': { description: 'Discovery endpoint is available.' }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify(openapi, null, 2), {
    headers: {
      'Content-Type': 'application/vnd.oai.openapi+json; charset=utf-8'
    }
  })
}
