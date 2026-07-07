import { agentSkillMarkdown } from '@/lib/agent-discovery'

export function GET() {
  return new Response(agentSkillMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
