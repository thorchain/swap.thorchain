import { JSX } from 'react'
import { HeaderUnstoppable } from '@/components/header/header-unstoppable'
import { HeaderThorchain } from '@/components/header/header-thorchain'

type AppKey = 'thorchain' | 'unstoppable'
type App = {
  id: AppKey
  title: string
  description: string
  favicon: string
  logo: string
  LogoText: () => JSX.Element
  supportEmail: string
  logoLink?: string
  gtag?: string
  pixelId?: string
  pixelEvent?: string
  discordLink?: string
  telegramLink?: string
}

const apps: Record<AppKey, App> = {
  unstoppable: {
    id: 'unstoppable',
    title: 'Unstoppable Swap',
    description: 'Unstoppable Swap',
    favicon: '/favicon-unstoppable.ico',
    logo: '/logo-unstoppable.svg',
    LogoText: HeaderUnstoppable,
    supportEmail: 'swap@horizontalsystems.io'
  },
  thorchain: {
    id: 'thorchain',
    title: 'THORChain Swap',
    description: 'THORChain Swap',
    favicon: '/favicon.ico',
    logo: '/logo.svg',
    LogoText: HeaderThorchain,
    logoLink: 'https://www.thorchain.org',
    gtag: 'G-VZ0FQ1WC7G',
    pixelId: 'qki4a',
    pixelEvent: 'tw-qki4a-qop3i',
    discordLink: 'https://discord.gg/eGrrwNE95w',
    telegramLink: 'https://t.me/thorchain_org',
    supportEmail: 'contact@thorchain.org'
  }
}

export const AppConfig = apps[process.env.NEXT_PUBLIC_APP as AppKey] || apps.unstoppable
