import { ProviderName } from '@tcswap/helpers'
import { HeaderLogoText } from '@/components/header/header-logo-text'

export const AppConfig = {
  id: 'thorchain',
  title: 'THORChain Swap',
  description: 'THORChain Swap',
  providers: [ProviderName.THORCHAIN, ProviderName.MAYACHAIN],
  favicon: '/favicon.ico',
  logo: '/logo.svg',
  LogoText: HeaderLogoText,
  logoLink: 'https://www.thorchain.org',
  gtag: 'G-VZ0FQ1WC7G',
  pixelId: 'qki4a',
  pixelEvent: 'tw-qki4a-qop3i',
  discordLink: 'https://discord.gg/eGrrwNE95w',
  telegramLink: 'https://t.me/thorchain_org',
  supportEmail: 'contact@thorchain.org'
}
