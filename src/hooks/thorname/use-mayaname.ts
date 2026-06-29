import { useQueries } from '@tanstack/react-query'
import { getMayaName, MayaName } from '@/lib/mayachain-api'

export const useMayaName = (names: string[]) => {
  const normalized = names.map(n => n.trim().toLowerCase())

  const results = useQueries({
    queries: normalized.map(name => ({
      queryKey: ['mayaname', name],
      queryFn: () => getMayaName(name),
      enabled: name.length > 0,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000
    }))
  })

  const mayaNames = results.map(r => r.data ?? null)
  const details = mayaNames.filter((d): d is MayaName => !!d)
  const isLoading = results.some((r, i) => normalized[i].length > 0 && (r.isLoading || r.isFetching))
  const isError = results.some((r, i) => normalized[i].length > 0 && r.isError)

  return { mayaNames, details, isLoading, isError }
}
