import { ProviderName } from '@tcswap/helpers'

export const AppConfig = {
  id: 'thorchain',
  title: 'THORChain Swap | Cross-Chain BTC, ETH & Crypto Swaps',
  description:
    'Swap Bitcoin to Ethereum and other cryptocurrencies instantly with THORChain. Native BTC swaps with no bridges, wrapping, or centralized exchanges.',
  baseUrl: 'https://swap.thorchain.org',
  providers: [ProviderName.THORCHAIN, ProviderName.MAYACHAIN],
  favicon: '/favicon.ico',
  logo: '/logo.svg',
  logoLink: 'https://www.thorchain.org',
  gtag: 'G-VZ0FQ1WC7G',
  pixelId: 'qki4a',
  pixelEvent: 'tw-qki4a-qop3i',
  discordLink: 'https://discord.gg/thorchaincommunity',
  telegramLink: 'https://t.me/thorchain_org',
  privacyPolicyLink: 'https://www.thorchain.org/privacy-policy',
  tosLink: 'https://www.thorchain.org/terms-of-use',
  supportEmail: 'contact@thorchain.org'
}

export const PRIMARY_HOST = 'swap.thorchain.org'

export const SUBDOMAIN_ROUTES = [
  { path: '/tcy', host: 'tcy.thorchain.org' },
  { path: '/bond', host: 'bond.thorchain.org' },
  { path: '/memo', host: 'memo.thorchain.org' },
  { path: '/pool', host: 'pool.thorchain.org' },
  { path: '/thorname', host: 'thorname.thorchain.org' }
] as const
