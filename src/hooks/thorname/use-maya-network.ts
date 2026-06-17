import { useQuery } from '@tanstack/react-query'
import { getMayaMimir } from '@/lib/api'
import { getMayaLastBlock } from '@/lib/mayachain-api'

const CACAO_DECIMALS = 1e10

export const useMayaNetwork = () => {
  const { data: mimir } = useQuery({
    queryKey: ['maya-mimir'],
    queryFn: getMayaMimir,
    refetchOnWindowFocus: false,
    staleTime: 60 * 60 * 1000
  })

  const { data: lastBlock } = useQuery({
    queryKey: ['maya-lastblock'],
    queryFn: getMayaLastBlock,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  // Fall back to the documented on-chain defaults when Mimir is unavailable.
  const registerFee = (Number(mimir?.TNSREGISTERFEE) || 100_000_000_000) / CACAO_DECIMALS
  const feePerBlock = (Number(mimir?.TNSFEEPERBLOCK) || 2000) / CACAO_DECIMALS

  return {
    currentBlock: lastBlock ?? 0,
    registerFee,
    feePerBlock
  }
}
