import { Chain } from '@tcswap/core'
import { TokenBalance } from '@/hooks/use-wallet-balances'

export function isRuneToken(t: TokenBalance): boolean {
  return t.balance.chain === Chain.THORChain && t.balance.ticker === 'RUNE'
}

export function isTcyToken(t: TokenBalance): boolean {
  return t.balance.chain === Chain.THORChain && t.balance.ticker === 'TCY'
}

export function isMemoToken(t: TokenBalance): boolean {
  return t.balance.chain === Chain.THORChain && (t.balance.ticker === 'RUNE' || t.balance.ticker === 'TCY')
}

const ZERO_PAYLOAD_PREFIXES = ['unbond', 'leave', 'rebond', 'pool-', 'tcy-', 'withdraw', 'wd:', '-:', 'operator', 'm=<']

export function isZeroPayloadMemo(memo: string): boolean {
  const lower = memo.toLowerCase().trim()
  if (!lower) return false
  return ZERO_PAYLOAD_PREFIXES.some(p => lower.startsWith(p))
}

const THOR_ADDRESS_RE = /^thor1[a-z0-9]{38}$/

export function isThorAddress(s: string): boolean {
  return THOR_ADDRESS_RE.test(s.trim())
}

export function parsePlaceholders(template: string): string[] {
  return template
    .split(':')
    .slice(1)
    .filter(p => /^[A-Z][A-Z0-9]+$/.test(p))
}

export function previewMemo(template: string, values: Record<string, string>): string {
  return template
    .split(':')
    .map((part, i) => {
      if (i === 0) return part
      if (/^[A-Z][A-Z0-9]+$/.test(part)) return values[part]?.trim() || part
      return part
    })
    .join(':')
}

export function composeMemo(template: string, values: Record<string, string>): string {
  const parts = template.split(':').map((part, i) => {
    if (i === 0) return part
    if (/^[A-Z][A-Z0-9]+$/.test(part)) return values[part]?.trim() ?? ''
    return part
  })

  while (parts.length > 1 && parts[parts.length - 1] === '') {
    parts.pop()
  }

  return parts.join(':')
}
