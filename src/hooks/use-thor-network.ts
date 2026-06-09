import { useQuery } from '@tanstack/react-query'
import { getThorLastBlock, getThorNetwork } from '@/lib/thorchain-api'

// THORChain targets ~6 second blocks
export const SECONDS_PER_BLOCK = 6
export const BLOCKS_PER_YEAR = (365 * 24 * 60 * 60) / SECONDS_PER_BLOCK // ≈ 5,256,000

export const useThorNetwork = () => {
  const { data: network } = useQuery({
    queryKey: ['thor-network'],
    queryFn: getThorNetwork,
    refetchOnWindowFocus: false,
    staleTime: 60 * 60 * 1000
  })

  const { data: lastBlock } = useQuery({
    queryKey: ['thor-lastblock'],
    queryFn: getThorLastBlock,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  // Fees are returned in 1e8 units (tor). Fall back to documented defaults.
  const registerFeeRune = (Number(network?.tns_register_fee_rune) || 1_000_000_000) / 1e8
  const feePerBlockRune = (Number(network?.tns_fee_per_block_rune) || 20) / 1e8

  return {
    currentBlock: lastBlock ?? 0,
    registerFeeRune,
    feePerBlockRune
  }
}

// Resolve a future block height into an approximate calendar date.
export const blockHeightToDate = (targetHeight: number, currentBlock: number): Date | null => {
  if (!targetHeight || !currentBlock) return null
  const secondsAway = (targetHeight - currentBlock) * SECONDS_PER_BLOCK
  return new Date(Date.now() + secondsAway * 1000)
}
