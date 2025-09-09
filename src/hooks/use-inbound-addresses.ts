import { useQuery } from '@tanstack/react-query'
import { getInboundAddresses } from '@/lib/api'

type InboundAddress = {
  chain: string
  pub_key: string
  address: string
  router?: string
  halted: boolean
  global_trading_paused: boolean
  chain_trading_paused: boolean
  chain_lp_actions_paused: boolean
  observed_fee_rate: string
  gas_rate: string
  gas_rate_units: string
  outbound_tx_size: string
  outbound_fee: string
  dust_threshold: string
}

export const useInboundAddresses = (): { data: InboundAddress[] | undefined; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: ['inbound-addresses'],
    queryFn: () => getInboundAddresses()
  })

  return { data, isLoading }
}
