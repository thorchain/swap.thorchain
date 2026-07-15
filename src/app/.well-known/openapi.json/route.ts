import { AppConfig } from '@/config'

const errorContent = {
  'application/json': {
    schema: { $ref: '#/components/schemas/Error' }
  }
}

// Declared on every write operation: retries with the same key replay the
// original response instead of re-executing (see src/lib/idempotency.ts).
const idempotencyKeyParameter = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  description:
    'Unique client-generated key making the request idempotent: a retry with the same key within one hour replays the original JSON response (marked with an Idempotency-Replayed: true response header) instead of re-executing the operation. 429 and 5xx outcomes are not stored, so retries after those can succeed.',
  schema: { type: 'string', maxLength: 255 }
}

export function GET() {
  const openapi = {
    openapi: '3.1.0',
    info: {
      title: 'THORChain Swap Public API',
      version: '1.0.0',
      description:
        'Public support endpoints exposed by the THORChain Swap web interface. All error responses are JSON objects with a machine-readable code, a human-readable message, and a resolution hint.\n\nVersioning: the API is versioned in the URL path (/api/v1/). The unversioned /api/* paths are stable aliases of the newest major version. Breaking changes ship as a new /api/vN prefix with at least six months of overlap; deprecated endpoints signal retirement with Deprecation and Sunset response headers and are documented on the developer portal.',
      contact: {
        name: 'THORChain Swap',
        url: `${AppConfig.baseUrl}/developers`,
        email: AppConfig.supportEmail
      }
    },
    externalDocs: {
      description: 'THORChain Swap developer portal',
      url: `${AppConfig.baseUrl}/developers`
    },
    servers: [{ url: AppConfig.baseUrl }],
    // Anonymous access (the empty object) is currently permitted on every
    // endpoint; agentOAuth documents the scoped model for when self-service
    // credential issuance is enabled. Scopes match
    // /.well-known/oauth-authorization-server.
    security: [{}, { agentOAuth: ['read:public'] }],
    paths: {
      '/api/v1/newsletter': {
        post: {
          summary: 'Subscribe an email address to THORChain Swap updates.',
          operationId: 'subscribeNewsletter',
          security: [{}, { agentOAuth: ['submit:feedback'] }],
          parameters: [idempotencyKeyParameter],
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
            '200': {
              description: 'Subscription accepted.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Success' }
                }
              }
            },
            '400': { description: 'Invalid JSON body or invalid email address.', content: errorContent },
            '405': { description: 'Method not allowed; only POST is supported.', content: errorContent },
            '429': {
              description: 'Rate limit exceeded. Retry after the number of seconds in the Retry-After header.',
              content: errorContent
            },
            '500': { description: 'Server misconfiguration or upstream provider error.', content: errorContent }
          }
        }
      },
      '/api/v1/report-bug': {
        post: {
          summary: 'Submit a bug report or feature request.',
          operationId: 'reportBug',
          security: [{}, { agentOAuth: ['submit:feedback'] }],
          parameters: [idempotencyKeyParameter],
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
            '200': {
              description: 'Report accepted.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Success' }
                }
              }
            },
            '400': { description: 'Invalid JSON body or missing description.', content: errorContent },
            '405': { description: 'Method not allowed; only POST is supported.', content: errorContent },
            '429': {
              description: 'Rate limit exceeded. Retry after the number of seconds in the Retry-After header.',
              content: errorContent
            },
            '500': { description: 'Server misconfiguration or upstream provider error.', content: errorContent }
          }
        }
      },
      '/.well-known/status': {
        get: {
          summary: 'Return discovery endpoint status.',
          operationId: 'getDiscoveryStatus',
          security: [{}, { agentOAuth: ['read:public'] }],
          responses: {
            '200': { description: 'Discovery endpoint is available.' }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        agentOAuth: {
          type: 'oauth2',
          description:
            'Scoped OAuth 2.0 access for agents. Anonymous access is currently permitted on all public endpoints, so credentials are optional; the scopes below define the least-privilege access an agent should request once self-service issuance is enabled. See /auth.md and /.well-known/oauth-authorization-server.',
          flows: {
            authorizationCode: {
              authorizationUrl: `${AppConfig.baseUrl}/agent-auth/authorize`,
              tokenUrl: `${AppConfig.baseUrl}/agent-auth/token`,
              scopes: {
                'read:public': 'Read public discovery documents, quotes, pools, and network data.',
                'submit:feedback': 'Submit newsletter subscriptions and bug reports.'
              }
            }
          }
        }
      },
      schemas: {
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true }
          },
          required: ['success']
        },
        Error: {
          type: 'object',
          description: 'Structured error returned by every non-2xx API response.',
          properties: {
            error: { type: 'string', description: 'Human-readable error message.' },
            code: {
              type: 'string',
              description: 'Machine-readable error code.',
              enum: [
                'invalid_json',
                'invalid_idempotency_key',
                'invalid_email',
                'missing_description',
                'method_not_allowed',
                'not_found',
                'rate_limited',
                'server_misconfigured',
                'upstream_error',
                'delivery_failed'
              ]
            },
            hint: { type: 'string', description: 'Suggested resolution for the caller.' },
            documentation: { type: 'string', format: 'uri', description: 'Link to the developer portal.' }
          },
          required: ['error', 'code', 'hint']
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
