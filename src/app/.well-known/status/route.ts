import { AppConfig } from '@/config'

export function GET() {
  return Response.json({
    status: 'ok',
    service: 'thorchain-swap',
    url: AppConfig.baseUrl
  })
}
