import { useQueries } from '@tanstack/react-query'
import { getThorName, ThorName } from '@/lib/thorchain-api'

export const useThorName = (names: string[]) => {
  const normalized = names.map(n => n.trim().toLowerCase())

  const results = useQueries({
    queries: normalized.map(name => ({
      queryKey: ['thorname', name],
      queryFn: () => getThorName(name),
      enabled: name.length > 0,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000
    }))
  })

  const thorNames = results.map(r => r.data ?? null)
  const details = thorNames.filter((d): d is ThorName => !!d)
  const isLoading = results.some((r, i) => normalized[i].length > 0 && (r.isLoading || r.isFetching))

  return { thorNames, details, isLoading }
}
