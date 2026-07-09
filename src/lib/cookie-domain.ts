// A real TLD is never all-digits, so an all-digit last label means a bare IP.
function isIpHost(host: string): boolean {
  const lastLabel = host.slice(host.lastIndexOf('.') + 1)
  return lastLabel.length > 0 && [...lastLabel].every(c => c >= '0' && c <= '9')
}

// ".domain.org" so a cookie is shared across subdomains;
// undefined for localhost / bare IPs, where only host-only cookies are valid.
export function parentCookieDomain(host: string): string | undefined {
  const hostname = host.split(':')[0]
  const parts = hostname.split('.')
  if (hostname === 'localhost' || isIpHost(hostname) || parts.length < 2) return undefined
  return `.${parts.slice(-2).join('.')}`
}
