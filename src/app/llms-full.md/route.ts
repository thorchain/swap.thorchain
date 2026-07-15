import { llmsFullMarkdown } from '@/lib/agent-discovery'

export function GET() {
  return new Response(llmsFullMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
