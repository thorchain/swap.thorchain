import { useQuery } from '@tanstack/react-query'
import { getMayaMimir, getMimir } from '@/lib/api'

export const useMimir = () => {
  const { data: mimir, isLoading } = useQuery({
    queryKey: ['mimir'],
    queryFn: getMimir,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 60 * 1000 // 1 hour
  })

  const { data: mayaMimir, isLoading: isMayaLoading } = useQuery({
    queryKey: ['maya-mimir'],
    queryFn: getMayaMimir,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 60 * 60 * 1000 // 1 hour
  })

  return {
    mimir: mimir ?? ({} as Record<string, number>),
    mayaMimir: mayaMimir ?? ({} as Record<string, number>),
    isLoading: isLoading || isMayaLoading
  }
}