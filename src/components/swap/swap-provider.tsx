import Image from 'next/image'
import { ProviderName } from '@tcswap/helpers'
import { providerLabel } from '@/lib/swap-helpers'

// Providers without an icon of their own under public/providers show their name alone.
const PROVIDER_ICONS: Record<string, string> = {
  THORCHAIN: 'thorchain',
  THORCHAIN_STREAMING: 'thorchain',
  MAYACHAIN: 'mayachain',
  MAYACHAIN_STREAMING: 'mayachain',
  NEAR: 'near',
  ONEINCH: 'oneinch',
  HOUDINI: 'houdini',
  HOUDINI_PRIVATE: 'houdini'
}

export const SwapProvider = ({ provider }: { provider: ProviderName }) => {
  const icon = PROVIDER_ICONS[provider]

  return (
    <div className="flex items-center gap-2">
      {icon && <Image src={`/providers/${icon}.svg`} alt="" width="16" height="16" />}
      <span className="text-txt-high-contrast font-semibold">{providerLabel(provider)}</span>
    </div>
  )
}
