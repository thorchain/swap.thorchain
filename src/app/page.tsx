import Script from 'next/script'
import { Header } from '@/components/header/header'
import { Swap } from '@/components/swap/swap'
import { GlobalDialog } from '@/components/global-dialog'
import { Footer } from '@/components/footer/footer'
import { AppConfig } from '@/config'

export default async function Page() {
  return (
    <main className="min-h-screen">
      <Header />
      <Swap />
      <GlobalDialog />
      <Footer />
      {AppConfig.pixelEvent && (
        <Script
          id="twitter-events"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: `twq('event', '${AppConfig.pixelEvent}', {})` }}
        />
      )}
    </main>
  )
}
