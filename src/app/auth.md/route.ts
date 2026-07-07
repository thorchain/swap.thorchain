import { authMarkdown } from '@/lib/agent-discovery'

export function GET() {
  return new Response(authMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
