import { NextResponse } from 'next/server'
import { AppConfig } from '@/config'

// Structured JSON error body for the public /api/* endpoints. `error` keeps the
// original human-readable string for existing clients; `code` and `hint` give
// agents a stable machine-readable code and a resolution hint.
export function apiError(status: number, code: string, message: string, hint: string, headers?: HeadersInit) {
  return NextResponse.json(
    { error: message, code, hint, documentation: `${AppConfig.baseUrl}/developers` },
    { status, headers }
  )
}

export function methodNotAllowed(allow: string[]) {
  const handler = () =>
    apiError(
      405,
      'method_not_allowed',
      'Method not allowed',
      `This endpoint only supports: ${allow.join(', ')}.`,
      { Allow: allow.join(', ') }
    )
  return handler
}
