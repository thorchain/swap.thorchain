import { AppConfig } from '@/config'

export const aboutMarkdown = `# About THORChain Swap

THORChain Swap is a public web interface for exchanging native crypto assets across blockchains through THORChain and Maya Protocol. It does not require wrapped assets, a centralized exchange account, or custody by this website.

## Self-Custody

Connected-wallet transactions are signed locally by the user. Memoless swaps let a user send funds from a self-custody wallet to a time-limited deposit address. THORChain Swap does not hold private keys, sign transactions for users, or custody funds.

## Open Integrations

- Developer resources: ${AppConfig.baseUrl}/developers
- Agent guidance: ${AppConfig.baseUrl}/AGENTS.md
- Source code: https://github.com/thorchain/swap.thorchain
- Contact and support: ${AppConfig.baseUrl}/contact
`

export const contactMarkdown = `# Contact THORChain Swap

## Support

- Email: ${AppConfig.supportEmail}
- Discord: ${AppConfig.discordLink}
- Telegram: ${AppConfig.telegramLink}
- GitHub issues: https://github.com/thorchain/swap.thorchain/issues
- Developer resources: ${AppConfig.baseUrl}/developers

## Security Warning

Never send anyone your seed phrase, private key, wallet backup, or signing credentials. Legitimate support will never ask for them. Do not include wallet secrets, private account data, or confidential credentials in bug reports.
`
