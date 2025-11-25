import { HeaderUnstoppable } from '@/components/header/header-unstoppable'
import { HeaderThorchain } from '@/components/header/header-thorchain'

type AppKey = 'thorchain' | 'unstoppable'

const apps = {
  thorchain: {
    title: 'THORChain Swap',
    description: 'THORChain Swap',
    logo: '/logo.svg',
    LogoText: HeaderThorchain
  },
  unstoppable: {
    title: 'Unstoppable Swap',
    description: 'Unstoppable Swap',
    logo: '/logo-unstoppable.png',
    LogoText: HeaderUnstoppable
  }
}

export const AppConfig = apps[process.env.NEXT_PUBLIC_APP as AppKey] || apps.unstoppable
