import type { Metadata } from 'next'
import Link from 'next/link'
import { AppConfig } from '@/config'

export const metadata: Metadata = {
  title: 'About THORChain Swap',
  description: 'How THORChain Swap provides native, self-custodial cross-chain swaps through THORChain and Maya Protocol.',
  alternates: { canonical: `${AppConfig.baseUrl}/about` },
  openGraph: {
    title: 'About THORChain Swap',
    description: 'Native, self-custodial cross-chain swaps powered by THORChain and Maya Protocol.',
    url: `${AppConfig.baseUrl}/about`,
    siteName: 'THORChain Swap',
    type: 'website'
  }
}

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${AppConfig.baseUrl}/about#webpage`,
  name: 'About THORChain Swap',
  url: `${AppConfig.baseUrl}/about`,
  isPartOf: { '@id': `${AppConfig.baseUrl}/#website` },
  about: { '@id': `${AppConfig.baseUrl}/#webapplication` }
}

export default function AboutPage() {
  return (
    <main lang="en" className="bg-body min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link href="/" className="text-txt-high-contrast text-sm font-semibold">
            THORChain Swap
          </Link>
          <Link href="/" className="text-txt-med-contrast text-sm underline">
            Open the swap interface
          </Link>
        </div>
      </header>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
      <article className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-txt-high-contrast text-3xl font-bold">About THORChain Swap</h1>
        <div className="text-txt-med-contrast mt-6 space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-txt-high-contrast text-xl font-semibold">Native cross-chain swaps</h2>
            <p className="mt-3">
              THORChain Swap is a public web interface for exchanging native crypto assets across blockchains through THORChain and Maya Protocol. It
              does not require wrapped assets, a centralized exchange account, or custody by this website.
            </p>
          </section>
          <section>
            <h2 className="text-txt-high-contrast text-xl font-semibold">Self-custody</h2>
            <p className="mt-3">
              Connected-wallet transactions are signed locally by the user. Memoless swaps let a user send funds from a self-custody wallet to a
              time-limited deposit address. THORChain Swap does not hold private keys, sign transactions for users, or custody funds.
            </p>
          </section>
          <section>
            <h2 className="text-txt-high-contrast text-xl font-semibold">Open integrations</h2>
            <p className="mt-3">
              The interface is open source. Developers and AI agents can use the public documentation, OpenAPI description, Agent Skills, and
              read-only MCP tools without creating an account.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                <Link className="underline" href="/developers">
                  Developer resources
                </Link>
              </li>
              <li>
                <a className="underline" href="https://github.com/thorchain/swap.thorchain" rel="noopener noreferrer" target="_blank">
                  Source code
                </a>
              </li>
              <li>
                <Link className="underline" href="/contact">
                  Contact and support
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </main>
  )
}
