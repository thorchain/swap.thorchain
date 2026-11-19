import { useQuery } from '@tanstack/react-query'
import { getProviders } from '@/lib/aggregator'
import { AggregatorProvider } from '@/types'

// Streaming is a request option in v3, not a provider of its own.
const STREAMING_TO_BASE: Record<string, string> = {
  THORCHAIN_STREAMING: 'THORCHAIN',
  MAYACHAIN_STREAMING: 'MAYACHAIN'
}

// The aggregator's providers (GET /providers): how each is paid, and how its own support is reached.
// The list changes only with the server's configuration, so one answer serves the session.
export const useProviders = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: getProviders,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })

  const providers = data ?? []
  const byProvider = new Map<string, AggregatorProvider>(providers.map(p => [p.provider, p]))

  const getProvider = (name?: string): AggregatorProvider | undefined => (name ? byProvider.get(STREAMING_TO_BASE[name] ?? name) : undefined)

  return { providers, getProvider, isLoading }
}
