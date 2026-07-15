import { developersMarkdown } from '@/lib/developer-portal'

export function GET() {
  return new Response(developersMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
