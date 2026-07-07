import { agentsMarkdown } from '@/lib/agent-discovery'

export function GET() {
  return new Response(agentsMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
