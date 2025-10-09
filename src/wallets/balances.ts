import axios from 'axios'
import { ethers } from 'ethers'
import { Chain } from '@swapkit/helpers'

export class BalanceFetcher {
  static async fetch(asset: string, address: string): Promise<bigint> {
    const [chain, symbol] = asset.split('.')
    const [, id] = symbol.split('-')

    const network = chain as Chain

    switch (network) {
      case Chain.Ethereum:
      case Chain.BinanceSmartChain:
      case Chain.Avalanche:
      case Chain.Base: {
        const url = evmRpcUrls[network]
        const provider = new ethers.JsonRpcProvider(url)

        if (id) {
          return this.fetchEip20Balance(provider, id, address)
        } else {
          return this.fetchEvmBalance(provider, address)
        }
      }
      case Chain.Bitcoin: {
        const res = await axios.get(`https://blockchain.info/balance?active=${address}`)
        return BigInt(res.data[address].final_balance)
      }
      case Chain.Litecoin:
        return this.fetchBlockchairBalance('litecoin', address)

      case Chain.Dogecoin:
        return this.fetchBlockchairBalance('dogecoin', address)

      case Chain.BitcoinCash:
        return this.fetchBlockchairBalance('bitcoin-cash', address)

      case Chain.Ripple: {
        const res = await axios.get(`https://api.xrpscan.com/api/v1/account/${address}`)
        return BigInt(res.data.Balance) * 10n ** 2n
      }
      case Chain.Cosmos:
      case Chain.THORChain: {
        const res = await axios.get(`https://thornode.ninerealms.com/bank/balances/${address}`)
        const amount = res.data.result.find((i: any) => i.denom.toUpperCase() === symbol)?.amount
        return amount ? BigInt(amount) : 0n
      }
      default: {
        return 0n
      }
    }
  }

  static async fetchEvmBalance(provider: ethers.JsonRpcProvider, address: string): Promise<bigint> {
    const balance = await provider.getBalance(address)
    return balance / 10n ** 10n
  }

  static async fetchEip20Balance(
    provider: ethers.JsonRpcProvider,
    contractAddress: string,
    address: string
  ): Promise<bigint> {
    const tokenAddress = ethers.getAddress(contractAddress.toLowerCase())
    const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']
    const contract = new ethers.Contract(tokenAddress, abi, provider)
    const balance = BigInt(await contract.balanceOf(address.toLowerCase()))
    const decimals = BigInt(await contract.decimals())
    return (balance * 10n ** 8n) / 10n ** decimals
  }

  static async fetchBlockchairBalance(chain: string, address: string): Promise<bigint> {
    const res = await axios.get(
      `https://api.blockchair.com/${chain}/dashboards/address/${address}?key=${process.env.NEXT_PUBLIC_BLOCKCHAIR_API_KEY}`
    )
    return BigInt(res.data.data[address].address.balance)
  }
}

const evmRpcUrls: Partial<Record<Chain, string>> = {
  [Chain.Ethereum]: `https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_PROJECT_ID}`,
  [Chain.BinanceSmartChain]: 'https://bsc-dataseed.binance.org',
  [Chain.Avalanche]: 'https://api.avax.network/ext/bc/C/rpc',
  [Chain.Base]: 'https://mainnet.base.org'
}
