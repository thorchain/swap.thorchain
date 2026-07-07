import { AppConfig } from '@/config'

export function GET() {
  return Response.json({
    issuer: AppConfig.baseUrl,
    authorization_endpoint: `${AppConfig.baseUrl}/agent-auth/authorize`,
    token_endpoint: `${AppConfig.baseUrl}/agent-auth/token`,
    jwks_uri: `${AppConfig.baseUrl}/.well-known/jwks.json`,
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    scopes_supported: ['read:public', 'submit:feedback'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    service_documentation: `${AppConfig.baseUrl}/auth.md`,
    agent_auth: {
      skill: 'auth.md',
      register_uri: `${AppConfig.baseUrl}/auth.md`,
      identity_types_supported: ['anonymous'],
      anonymous: {
        credential_types_supported: ['none'],
        claim_uri: `${AppConfig.baseUrl}/auth.md`
      }
    }
  })
}
