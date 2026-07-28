import type { Metadata } from 'next'
import { AppConfig } from '@/config'

// Shared Open Graph / Twitter image used across every page. Next.js does not
// deep-merge `openGraph`/`twitter` from the root layout, so any page that sets
// its own must re-declare the image or it would be dropped from the card.
const ogImage = {
  url: `${AppConfig.baseUrl}/og-image.png`,
  width: 2400,
  height: 1260,
  alt: 'THORChain'
}

/**
 * Build per-page SEO metadata with a page-specific title and description while
 * keeping the shared Open Graph / Twitter image intact.
 */
export function buildPageMetadata({ title, description }: { title: string; description: string }): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'THORChain Swap',
      images: [ogImage],
      type: 'website',
      locale: 'en_US'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    }
  }
}
