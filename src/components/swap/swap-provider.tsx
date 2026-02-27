import Image from 'next/image'
import { ProviderName } from '@tcswap/helpers'
import { providerLabel } from '@/lib/swap-helpers'

export const SwapProvider = ({ provider }: { provider: ProviderName }) => {
  let icon = ''

  if (provider === 'THORCHAIN' || provider === 'THORCHAIN_STREAMING') {
    icon = 'thorchain'
  } else if (provider === 'MAYACHAIN' || provider === 'MAYACHAIN_STREAMING') {
    icon = 'mayachain'
  } else if (provider === 'NEAR') {
    icon = 'near'
  } else if (provider === 'ONEINCH') {
    icon = 'oneinch'
  }

  return (
    <div className="flex items-center gap-2">
      <Image src={`/providers/${icon}.svg`} alt="" width="16" height="16" />
      <span className="text-leah font-bold">{providerLabel(provider)}</span>
    </div>
  )
}
