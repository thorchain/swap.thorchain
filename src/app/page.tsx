import { Header } from '@/components/header'
import { Swap } from '@/components/swap/swap'
import { getQueryClient } from '@/hooks/react-query-client'
import { getPools } from '@/lib/api'
import { GlobalDialog } from '@/components/global-dialog'

export default async function Home() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['pools'],
    queryFn: () => getPools()
  })

  return (
    <main className="min-h-screen">
      <Header />
      <Swap />
      <GlobalDialog />
    </main>
  )
}
