import { useQueries, useQuery } from '@tanstack/react-query'
import { BLOCKS_PER_YEAR } from '@/components/send-memo/send-memo-helpers'
import { ThorNodeInfo, getBondProviderNodes, getLastChurnHeight, getThorNodeInfo } from '@/lib/api'
import { getThorLastBlock } from '@/lib/thorchain-api'

export interface BondedNode {
  address: string
  status: string
  bond: number
  // Before the operator fee
  apr: number
  // Fraction, 0.2 = 20%
  fee: number
  // Bond Yield payout share of the rewards, fraction
  yieldShare: number
  // After the operator fee and the Bond Yield payout: the share that compounds
  netApr: number
  nextReward: number
}

export interface BondPosition {
  nodes: BondedNode[]
  bond: number
  nextReward: number
  yearlyReward: number
  apr: number
  // The Bond Yield payout across nodes
  yearlyYield: number
  yieldApr: number
}

// The node's bond APR over the churn window, and what a given provider address
// keeps of it after the operator fee.
export function nodeAprForProvider(info: ThorNodeInfo, blocks: number, address: string) {
  const totalBond = parseInt(info.total_bond) / 1e8
  const award = parseInt(info.current_award) / 1e8
  const yearly = (award / blocks) * BLOCKS_PER_YEAR
  const apr = totalBond > 0 ? yearly / totalBond : 0
  // node_operator_fee is in basis points (10000 = 100%)
  const fee = parseInt(info.bond_providers?.node_operator_fee ?? '0') / 10000
  // The operator pays no fee on its own bond; the fee it collects from others is not yield on this bond
  const feePaid = info.node_operator_address === address ? 0 : fee
  return { apr, fee, feePaid, netApr: apr * (1 - feePaid) }
}

// Blocks since the last churn: the window current_award accrued over
export const useBondRewardPeriod = (enabled: boolean) =>
  useQuery({
    queryKey: ['bond-reward-period'],
    queryFn: async () => {
      const [churnHeight, height] = await Promise.all([getLastChurnHeight(), getThorLastBlock()])
      return { blocks: Math.max(height - churnHeight, 1) }
    },
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

export const useBondPosition = (address: string) => {
  const trimmed = address.trim()

  const bonds = useQuery({
    queryKey: ['bond-provider-nodes', trimmed],
    queryFn: () => getBondProviderNodes(trimmed),
    enabled: trimmed.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  const period = useBondRewardPeriod(trimmed.length > 0)

  // Midgard keeps listing nodes whose bond is fully withdrawn
  const bondedNodes = bonds.data?.nodes.filter(n => parseInt(n.bond) > 0) ?? []
  const nodeAddresses = bondedNodes.map(n => n.address)
  const nodeInfos = useQueries({
    queries: nodeAddresses.map(node => ({
      queryKey: ['node-info', node],
      queryFn: () => getThorNodeInfo(node),
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000
    }))
  })

  // An empty position is often a pasted node address. THORNode reports status "Unknown" for a non-node address.
  const pastedNode = useQuery({
    queryKey: ['node-info', trimmed],
    queryFn: () => getThorNodeInfo(trimmed),
    enabled: bonds.data?.nodes.length === 0,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })
  const nodeOperator = pastedNode.data && pastedNode.data.status !== 'Unknown' ? pastedNode.data.node_operator_address : undefined

  const isLoading = trimmed.length > 0 && (bonds.isLoading || period.isLoading || nodeInfos.some(q => q.isLoading) || pastedNode.isLoading)
  const error = bonds.error || period.error || nodeInfos.find(q => q.error)?.error

  let position: BondPosition | undefined
  if (bonds.data && period.data && nodeInfos.every(q => q.data)) {
    let yearlyYield = 0
    const nodes = bondedNodes.map((n, i): BondedNode => {
      const info = nodeInfos[i].data!
      const provider = info.bond_providers?.providers.find(p => p.bond_address === trimmed)
      const bond = parseInt(provider?.bond ?? n.bond) / 1e8
      const totalBond = parseInt(info.total_bond) / 1e8
      const award = parseInt(info.current_award) / 1e8
      const { apr, fee, feePaid, netApr: aprAfterFee } = nodeAprForProvider(info, period.data.blocks, trimmed)
      const yieldShare = (parseInt(String(provider?.bps ?? 0)) || 0) / 10000
      const share = totalBond > 0 ? bond / totalBond : 0
      const nextReward = award * share * (1 - feePaid)
      yearlyYield += bond * aprAfterFee * yieldShare
      return { address: n.address, status: info.status, bond, apr, fee, yieldShare, netApr: aprAfterFee * (1 - yieldShare), nextReward }
    })

    const bond = nodes.reduce((sum, n) => sum + n.bond, 0)
    const yearlyReward = nodes.reduce((sum, n) => sum + n.bond * n.netApr, 0)
    position = {
      nodes: nodes.sort((a, b) => b.bond - a.bond),
      bond,
      nextReward: nodes.reduce((sum, n) => sum + n.nextReward, 0),
      yearlyReward,
      apr: bond > 0 ? yearlyReward / bond : 0,
      yearlyYield,
      yieldApr: bond > 0 ? yearlyYield / bond : 0
    }
  }

  return { position, nodeOperator, isLoading, error }
}
