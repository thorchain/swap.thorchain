// The announcement banner is published from the affiliate admin (/banner there)
// and read at runtime, so putting one up is a save rather than a deploy.

export const BANNER_API_URL = process.env.BANNER_API_URL || 'https://affiliate.thorchain.org/api/banner'

export type BannerCopy = { title: string; text?: string; link?: string }

export type Banner = {
  enabled: boolean
  // Doubles as the per-visitor dismissal marker; the admin derives it from the
  // copy, so reworded banners re-appear for people who closed the last one.
  id: string
  icon: string
  href: string
  locales: Record<string, Partial<BannerCopy> | undefined>
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const copy = (value: unknown): Partial<BannerCopy> | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const { title, text, link } = value as Record<string, unknown>
  const block: Partial<BannerCopy> = {}
  if (str(title)) block.title = str(title)
  if (str(text)) block.text = str(text)
  if (str(link)) block.link = str(link)
  return Object.keys(block).length ? block : undefined
}

// Everything crossing the wire goes through here: a malformed payload costs the
// banner, never the header it renders in.
export function normalizeBanner(value: unknown): Banner {
  if (!value || typeof value !== 'object') return { enabled: false, id: '', icon: '', href: '', locales: {} }
  const raw = value as Record<string, unknown>
  const rawLocales = raw.locales && typeof raw.locales === 'object' ? (raw.locales as Record<string, unknown>) : {}

  const locales: Banner['locales'] = {}
  for (const [locale, block] of Object.entries(rawLocales)) {
    const parsed = copy(block)
    if (parsed) locales[locale] = parsed
  }

  return {
    enabled: raw.enabled === true,
    id: str(raw.id),
    icon: str(raw.icon),
    href: str(raw.href),
    locales
  }
}

// No banner. What this app shows before the first fetch lands and if the admin
// cannot be reached — never a banner baked in at build time, which would come
// back from the dead on a deploy long after it was taken down.
export const FALLBACK_BANNER: Banner = normalizeBanner(null)

// An icon is either a file in this app's /public or the admin's upload, proxied
// through our own /api/banner/icon. Both are same-origin paths — the value comes
// over the network, so anything else (another host, a javascript: URL) is dropped.
export const bannerIcon = (icon: string): string => (icon.startsWith('/') && !icon.startsWith('//') ? icon : '')

export const bannerCopy = (banner: Banner, locale: string): Partial<BannerCopy> => ({
  ...banner.locales.en,
  ...banner.locales[locale]
})
