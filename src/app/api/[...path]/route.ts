import { NextRequest } from 'next/server'
import { AppConfig } from '@/config'
import { apiError } from '@/lib/api-error'

// Catch-all for unknown /api/* paths so agents always get a JSON error
// instead of the HTML 404 page.
function handler(req: NextRequest) {
  return apiError(
    404,
    'not_found',
    `No API endpoint at ${req.nextUrl.pathname}`,
    `Available endpoints are documented in the OpenAPI description at ${AppConfig.baseUrl}/.well-known/openapi.json.`
  )
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD
}
