export function GET() {
  return Response.json(
    {
      error: 'agent_auth_not_enabled',
      error_description: 'Public self-service agent authorization is not currently enabled.'
    },
    { status: 501 }
  )
}
