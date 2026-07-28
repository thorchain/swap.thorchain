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
    <path
      d="M23.7911 7.42644C23.7911 3.36735 20.2767 0 15.9987 0C11.7207 0 8.20638 3.36904 8.20638 7.42644V9.80016H5V26.8737L15.9987 32L27 26.8703V9.87289H23.7936L23.7911 7.42644ZM12.1789 7.42644C12.1789 5.51275 13.8597 3.98129 15.9987 3.98129C18.1377 3.98129 19.8185 5.51275 19.8185 7.42644V9.80016H12.1789V7.42644ZM22.5684 24.1169L15.9987 27.1798L9.42903 24.1169V13.8576H22.5684V24.1169Z"
      fill="currentColor"
    />
  ),
  ledger: (
    <path
      d="M0 22.7655V31H12.0366V29.1738H1.75376V22.7655H0ZM30.2462 22.7655V29.1738H19.9634V30.9996H32V22.7655H30.2462ZM12.0541 10.2345V22.7651H19.9634V21.1183H13.8078V10.2345H12.0541ZM0 2V10.2345H1.75376V3.82574H12.0366V2H0ZM19.9634 2V3.82574H30.2462V10.2345H32V2H19.9634Z"
      fill="currentColor"
    />
  )
}

export function WalletIcon({ walletKey, width, height, alt = '', className }: WalletIconProps) {
  const glyph = MONO_GLYPHS[walletKey]
  if (glyph) {
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 32 32"
        fill="none"
        role="img"
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={className}
      >
        {glyph}
      </svg>
    )
  }

  return <Image src={`/wallets/${walletKey}.svg`} alt={alt} width={width} height={height} className={className} />
}
