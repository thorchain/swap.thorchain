import { useQuery } from '@tanstack/react-query'
import { getThorName } from '@/lib/thorchain-api'

export const useThorName = (name: string) => {
  const trimmed = name.trim().toLowerCase()
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['thorname', trimmed],
    queryFn: () => getThorName(trimmed),
    enabled: trimmed.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  })

  return { thorName: data ?? null, isLoading: trimmed.length > 0 && (isLoading || isFetching), error }
}
