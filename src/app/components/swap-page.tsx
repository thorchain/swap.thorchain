import Script from 'next/script'
import { Suspense } from 'react'
import { Footer } from '@/components/footer/footer'
import { GlobalDialog } from '@/components/global-dialog'
import { Header } from '@/components/header/header'
import { Swap } from '@/components/swap/swap'
import { AppConfig } from '@/config'

export function SwapPage() {
  return (
    <main className="min-h-screen">
      {/* Server-rendered for crawlers and screen readers; the swap widget below is client-rendered. */}
      <section className="sr-only">
        <h1>THORChain Swap — Native Cross-Chain Crypto Swaps</h1>
        <p>
          THORChain Swap is the official web interface for swapping native crypto assets across blockchains, powered by
          THORChain and Maya Protocol. Trade Bitcoin, Ethereum, stablecoins, and other layer-1 assets directly — no bridges,
          no wrapped tokens, no order books, and no user accounts. Swaps settle in native assets on their own chains.
        </p>
        <p>
          Connect your own wallet and sign transactions locally, or use a memoless instant swap with no wallet connection at
          all: send funds to a deposit address and receive the swapped asset at your destination address. Quotes show the
          expected output, fees, slippage, and estimated settlement time before you commit. The interface also supports
          streaming swaps, limit orders, liquidity pools, node bonding, and THORName registration.
        </p>
        <p>
          Developers and AI agents: see the <a href="/developers">THORChain Swap developer portal</a> for API documentation,
          the public MCP server with swap-quote, pool, and network tools, and <a href="/AGENTS.md">AGENTS.md</a> for agent
          guidance. Machine-readable discovery starts at <a href="/llms.txt">llms.txt</a>. The interface is open source at{' '}
          <a href="https://github.com/thorchain/swap.thorchain">github.com/thorchain/swap.thorchain</a>, with repository-level
          AGENTS.md instructions for AI coding agents.
        </p>
      </section>
      <Header />
      <Suspense>
        <Swap />
      </Suspense>
      <GlobalDialog />
      <Footer />
      {AppConfig.pixelEvent && (
        <Script id="twitter-events" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `twq('event', '${AppConfig.pixelEvent}', {})` }} />
      )}
    </main>
  )
}