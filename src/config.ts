import { ProviderName } from '@tcswap/helpers'
import { HeaderLogoText } from '@/components/header/header-logo-text'

export const AppConfig = {
  id: 'thorchain',
  baseUrl: 'https://swap.thorchain.org',
  title: 'Swap BTC to ETH & Other Assets | THORChain',
  description: "The World's Leading Bitcoin DEX",
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
  privacyPolicyLink: 'https://www.thorchain.org/privacy-policy',
  tosLink: 'https://www.thorchain.org/terms-of-use',
  supportEmail: 'contact@thorchain.org'
}
