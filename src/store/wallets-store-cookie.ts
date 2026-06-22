import type { Chain, WalletOption } from '@tcswap/core'

const ONE_YEAR = 60 * 60 * 24 * 365
const WALLET_LINK_COOKIE = 'tc-wallet-link'

// A real TLD is never all-digits, so an all-digit last label means a bare IP.
function isIpHost(host: string): boolean {
  const lastLabel = host.slice(host.lastIndexOf('.') + 1)
  return lastLabel.length > 0 && [...lastLabel].every(c => c >= '0' && c <= '9')
}

// "; Domain=.domain.org" so the cookie is shared across subdomains; empty for localhost / IPs
function domainAttr(): string {
  const host = window.location.hostname
  const parts = host.split('.')
  if (host === 'localhost' || isIpHost(host) || parts.length < 2) return ''
  return `; Domain=.${parts.slice(-2).join('.')}`
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const match = document.cookie.split('; ').find(c => c.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : null
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${domainAttr()}${secure}`
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domainAttr()}`
}

export interface WalletLink {
  provider: WalletOption
  chains: Chain[]
}

export function readWalletLink(): WalletLink[] {
  try {
    const parsed = JSON.parse(readCookie(WALLET_LINK_COOKIE) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Group accounts by provider into the shared cookie, or clear it when empty.
export function writeWalletLink(accounts: Array<{ provider: WalletOption; network: Chain }>): void {
  const byProvider = new Map<WalletOption, Set<Chain>>()
  for (const { provider, network } of accounts) {
    const chains = byProvider.get(provider) ?? new Set<Chain>()
    chains.add(network)
    byProvider.set(provider, chains)
  }

  if (byProvider.size === 0) {
    deleteCookie(WALLET_LINK_COOKIE)
    return
  }

  const link: WalletLink[] = Array.from(byProvider, ([provider, chains]) => ({ provider, chains: [...chains] }))
  writeCookie(WALLET_LINK_COOKIE, JSON.stringify(link))
}
