import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AssetValue,
  Chain,
  CosmosChain,
  CosmosChains,
  EVMChain,
  EVMChains,
  FeeOption,
  isGasAsset,
  USwapNumber,
  UTXOChain,
  UTXOChains
} from '@tcswap/core'
import { estimateTransactionFee } from '@tcswap/toolboxes/cosmos'
import { getProvider } from '@tcswap/toolboxes/evm'
import { Contract } from 'ethers'
import { useAssetFrom } from '@/hooks/use-swap'
import type { Asset } from '@/components/swap/asset'
import { useWallets } from '@/hooks/use-wallets'
import { getAssetBalance, getThorBankBalances } from '@/lib/api'
import { thorBalanceKey } from '@/lib/swap-helpers'
import { getUSwap } from '@/lib/wallets'

type UseBalance = {
  balance?: {
    total: USwapNumber
    spendable: USwapNumber
  } | null
  refetch: () => void
  isLoading: boolean
  error: Error | null
}

export const useBalance = (assetOverride?: Asset | null): UseBalance => {
  const uSwap = getUSwap()
  const swapAsset = useAssetFrom()
  const assetFrom = assetOverride === undefined ? swapAsset : assetOverride
  const { selected } = useWallets()
  const queryClient = useQueryClient()

  const {
    data: balance,
    refetch,
    isLoading,
    error
  } = useQuery({
    queryKey: ['balance', assetFrom?.identifier, selected?.provider],
    queryFn: async () => {
      if (!selected || !assetFrom) {
        return null
      }

      const wallet = uSwap.getWallet(selected.provider, assetFrom.chain)

      if (!wallet) {
        return null
      }

      let value = AssetValue.from({ chain: assetFrom.chain, value: 0 })

      // THORChain coins go by several names for one denom ("THOR.x/ruji" from the node and bank,
      // "THOR.RUJI" in the token list), so compare them by the same key the wallet sidebar uses.
      const thorKey =
        assetFrom.chain === Chain.THORChain
          ? thorBalanceKey({
              chain: Chain.THORChain,
              symbol: assetFrom.identifier.toUpperCase().startsWith('THOR.') ? assetFrom.identifier.slice(5) : assetFrom.identifier
            })
          : undefined

      const finder = (b: AssetValue) => {
        if (thorKey) return thorBalanceKey(b) === thorKey

        const symbolPart = b.isSynthetic || b.isTradeAsset ? b.ticker : b.symbol
        // Secured Assets are addressed as bare "<CHAIN>-<SYMBOL>" without a chain prefix.
        const id = b.isSecuredAsset ? b.symbol : `${b.chain}.${symbolPart}`
        return id.toLowerCase() === assetFrom.identifier.toLowerCase()
      }

      if (assetFrom.chain === Chain.Near) {
        const balances = await getAssetBalance(assetFrom.chain, wallet.address, assetFrom.identifier)
        const balance = balances.find(finder)

        if (balance) value = balance
      } else if ('getBalance' in wallet) {
        const balances = await queryClient.ensureQueryData({
          queryKey: ['account-balance', assetFrom.chain, wallet.address],
          queryFn: () => wallet.getBalance(wallet.address, false),
          staleTime: 30_000
        })
        const balance = balances.find(finder)

        if (balance) value = balance

        // Secured Assets and factory tokens (RUJI, sTCY, …) live in the THORChain bank module. If the
        // wallet wrapper didn't surface them (some connectors strip non-RUNE denoms), fall back to a
        // direct bank query — the same source the wallet sidebar reads.
        if (!balance && assetFrom.chain === Chain.THORChain) {
          const bankBalances = await getThorBankBalances(wallet.address)
          const bankBalance = bankBalances.find(finder)
          if (bankBalance) value = bankBalance
        }
      }

      // Aggregator /balance omits some ERC-20s (e.g. ETH.THOR); read them directly on-chain.
      if (!value.gt(0) && EVMChains.includes(assetFrom.chain as EVMChain) && assetFrom.address) {
        try {
          const provider = await getProvider(assetFrom.chain as EVMChain)
          const erc20 = new Contract(assetFrom.address, ['function balanceOf(address owner) view returns (uint256)'], provider)
          const raw: bigint = await erc20.balanceOf(wallet.address)
          if (raw > 0n) {
            value = AssetValue.from({ asset: assetFrom.identifier, fromBaseDecimal: assetFrom.decimals, value: raw.toString() })
          }
        } catch {
          // Leave value as-is if the on-chain read fails; the aggregator result still stands.
        }
      }

      const estimateFee = async () => {
        try {
          if (EVMChains.includes(assetFrom.chain as EVMChain)) {
            const gasLimit = 300_000n

            // Use the chain's configured RPC for gas, not the wallet's injected provider (which a
            // multi-chain wallet keeps on one network — e.g. Polygon's gwei would zero out ETH).
            const provider = await getProvider(assetFrom.chain as EVMChain)
            const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = await provider.getFeeData()

            if (gasPrice) {
              return USwapNumber.fromBigInt(gasPrice * gasLimit, assetFrom.decimals)
            }

            if (maxFeePerGas && maxPriorityFeePerGas) {
              const fee = (maxFeePerGas + maxPriorityFeePerGas) * gasLimit
              return USwapNumber.fromBigInt(fee, assetFrom.decimals)
            }

            return new USwapNumber(0)
          } else if (UTXOChains.includes(assetFrom.chain as UTXOChain)) {
            const utxoWallet = uSwap.getWallet<UTXOChain>(selected.provider, assetFrom.chain as UTXOChain)
            return await utxoWallet.estimateTransactionFee({
              recipient: selected.address,
              sender: selected.address,
              assetValue: value,
              memo: '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 80 chars
              feeOptionKey: FeeOption.Fast
            })
          } else if (CosmosChains.includes(assetFrom.chain as CosmosChain)) {
            return estimateTransactionFee({ assetValue: value })
          } else if (assetFrom.chain === Chain.Tron) {
            return new USwapNumber(1)
          }
        } catch (e) {
          console.log({ e })
        }

        return new USwapNumber(0)
      }

      const fee = isGasAsset({ chain: assetFrom.chain, symbol: assetFrom.ticker }) && value.gt(0) ? await estimateFee() : new USwapNumber(0)

      return {
        total: value,
        spendable: value.gt(fee) ? value.sub(fee) : new USwapNumber(0)
      }
    },
    enabled: !!(selected && assetFrom),
    retry: false,
    refetchOnMount: false
  })

  return {
    balance,
    refetch,
    isLoading,
    error
  }
}
