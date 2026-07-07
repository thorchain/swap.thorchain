import { llmsTxt } from '@/lib/agent-discovery'

export function GET() {
  return new Response(llmsTxt, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
