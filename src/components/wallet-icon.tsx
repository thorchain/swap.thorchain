import type { ReactNode } from 'react'
import Image from 'next/image'

interface WalletIconProps {
  walletKey: string
  width: number
  height: number
  alt?: string
  className?: string
}

// Monochrome glyphs render inline with `currentColor` so they track the
// surrounding text color — staying visible in either theme and when a button
// inverts its colors on hover. Colored brand logos keep their own artwork.
const MONO_GLYPHS: Record<string, ReactNode> = {
  trezor: (
    <>
      <path d="M10 14v-3a6 6 0 0 1 12 0v3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="6.25" y="14" width="19.5" height="13.5" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="16" cy="19.5" r="1.9" fill="currentColor" />
      <path d="M16 20.5v3.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  ledger: (
    <path
      d="M2 21.6174V29H12.5319V27.3628H3.53454V21.6174H2ZM28.4655 21.6174V27.3628H19.4681V28.9996H30V21.6174H28.4655ZM12.5473 10.3826V21.617H19.4681V20.1405H14.0819V10.3826H12.5473ZM2 3V10.3826H3.53454V4.63687H12.5319V3H2ZM19.4681 3V4.63687H28.4655V10.3826H30V3H19.4681Z"
      fill="currentColor"
    />
  )
}

export function WalletIcon({ walletKey, width, height, alt = '', className }: WalletIconProps) {
  const glyph = MONO_GLYPHS[walletKey]
  if (glyph) {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" fill="none" role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={className}>
        {glyph}
      </svg>
    )
  }

  return <Image src={`/wallets/${walletKey}.svg`} alt={alt} width={width} height={height} className={className} />
}
