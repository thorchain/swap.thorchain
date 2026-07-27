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
      <g clip-path="url(#clip0_4590_23351)">
        <path
          d="M23.0828 8.49814C23.0828 4.94643 19.8879 2 15.9988 2C12.1098 2 8.91489 4.94791 8.91489 8.49814V10.5751H6V25.5145L15.9988 30L26 25.5115V10.6388H23.0851L23.0828 8.49814ZM12.5263 8.49814C12.5263 6.82366 14.0543 5.48363 15.9988 5.48363C17.9434 5.48363 19.4714 6.82366 19.4714 8.49814V10.5751H12.5263V8.49814ZM21.9713 23.1023L15.9988 25.7824L10.0264 23.1023V14.1254H21.9713V23.1023Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_4590_23351">
          <rect width="20" height="28" fill="currentColor" transform="translate(6 2)" />
        </clipPath>
      </defs>
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
