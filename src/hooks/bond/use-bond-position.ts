import { useQueries, useQuery } from '@tanstack/react-query'
import { BLOCKS_PER_YEAR } from '@/components/send-memo/send-memo-helpers'
import { BondAction, ThorNodeInfo, getBondActions, getBondProviderNodes, getLastChurnHeight, getThorNodeInfo } from '@/lib/api'
import { getThorLastBlock } from '@/lib/thorchain-api'

export interface BondedNode {
  address: string
  status: string
  bond: number
  // Before the operator fee
  apr: number
  // Fraction, 0.2 = 20%
  fee: number
  netApr: number
  nextReward: number
}

export interface BondPosition {
  nodes: BondedNode[]
  bond: number
  nextReward: number
  yearlyReward: number
  apr: number
  totalRewards?: number
}

const runeIn = (coins: { amount: string }[]) => coins.reduce((sum, c) => sum + parseInt(c.amount), 0) / 1e8

// RUNE put into this address's bond in each node, net of what came out
function netDeposits(address: string, actions: BondAction[]) {
  const net = new Map<string, number>()
  const unknown = new Set<string>()
  const add = (node: string, amount: number) => net.set(node, (net.get(node) ?? 0) + amount)

  for (const action of actions) {
    if (action.status !== 'success') continue
    const signer = action.in[0]?.address
    // out[0] is the bond module's leg; older unbonds add the fee-deducted payout as a second out
    const amount = runeIn(action.out[0]?.coins ?? [])
    const { bond, rebond } = action.metadata

    if (action.type === 'rebond' && rebond) {
      const moved = runeIn(action.in[0]?.coins ?? []) || amount
      if (signer === address) add(rebond.nodeAddress, -moved)
      if (rebond.newBondAddress === address) add(rebond.nodeAddress, moved)
    } else if (action.type === 'bond' && bond) {
      // Credited to the signer, even when an operator whitelists a provider
      if (signer !== address) continue
      // Bonds carried over by the bond-provider migration have no amount
      if (!action.out[0]?.coins.length) unknown.add(bond.nodeAddress)
      add(bond.nodeAddress, amount)
    } else if (action.type === 'unbond' && bond) {
      // UNBOND:<node>:<amount>:<provider> is signed by the operator but comes out of the provider's bond
      const owner = bond.memo?.split(':')[3] || signer
      if (owner === address) add(bond.nodeAddress, -amount)
    }
  }
  return { net, unknown }
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

  const history = useQuery({
    queryKey: ['bond-actions', trimmed],
    queryFn: () => getBondActions(trimmed),
    enabled: !!bonds.data?.nodes.length,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000
  })

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
    const nodes = bondedNodes.map((n, i): BondedNode => {
      const info = nodeInfos[i].data!
      const provider = info.bond_providers?.providers.find(p => p.bond_address === trimmed)
      const bond = parseInt(provider?.bond ?? n.bond) / 1e8
      const totalBond = parseInt(info.total_bond) / 1e8
      const award = parseInt(info.current_award) / 1e8
      const { apr, fee, feePaid, netApr } = nodeAprForProvider(info, period.data.blocks, trimmed)
      const share = totalBond > 0 ? bond / totalBond : 0
      const nextReward = award * share * (1 - feePaid)
      return { address: n.address, status: info.status, bond, apr, fee, netApr, nextReward }
    })

    const bond = nodes.reduce((sum, n) => sum + n.bond, 0)

    // Rewards compound into the bond. Churn-out refunds leave no action, so this is a floor, exact if none happened.
    let totalRewards: number | undefined
    if (history.data) {
      const { net, unknown } = netDeposits(trimmed, history.data)
      const bondIn = new Map(nodes.map(n => [n.address, n.bond]))
      totalRewards = bonds.data.nodes.reduce((sum, n) => {
        if (unknown.has(n.address)) return sum
        const current = bondIn.get(n.address) ?? 0
        return sum + Math.max(current - (net.get(n.address) ?? 0), 0)
      }, 0)
    }

    const yearlyReward = nodes.reduce((sum, n) => sum + n.bond * n.netApr, 0)
    position = {
      nodes: nodes.sort((a, b) => b.bond - a.bond),
      bond,
      nextReward: nodes.reduce((sum, n) => sum + n.nextReward, 0),
      yearlyReward,
      apr: bond > 0 ? yearlyReward / bond : 0,
      totalRewards
    }
  }

  return { position, nodeOperator, isLoading, isHistoryLoading: history.isLoading, error }
}
