export function POST() {
  return Response.json(
    {
      error: 'agent_auth_not_enabled',
      error_description: 'Public self-service agent token issuance is not currently enabled.'
    },
    { status: 501 }
  )
}

export const GET = POST
