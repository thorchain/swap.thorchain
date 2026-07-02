import { AppConfig } from '@/config'

export function GET() {
  return Response.json({
    resource: AppConfig.baseUrl,
    authorization_servers: [AppConfig.baseUrl],
    scopes_supported: ['read:public', 'submit:feedback'],
    bearer_methods_supported: ['header']
  })
}
