import { AppConfig } from '@/config'
import { agentSkillDigest } from '@/lib/agent-discovery'

export function GET() {
  return Response.json({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'thorchain-swap',
        type: 'skill-md',
        description: 'Navigate and inspect the public THORChain Swap interface safely.',
        url: `${AppConfig.baseUrl}/.well-known/agent-skills/thorchain-swap/SKILL.md`,
        digest: agentSkillDigest
      }
    ]
  })
}
