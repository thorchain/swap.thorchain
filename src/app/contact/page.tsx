import type { Metadata } from 'next'
import Link from 'next/link'
import { AppConfig } from '@/config'

export const metadata: Metadata = {
  title: 'Contact THORChain Swap',
  description: 'Official support, community, and bug-reporting channels for THORChain Swap.',
  alternates: { canonical: `${AppConfig.baseUrl}/contact` },
  openGraph: {
    title: 'Contact THORChain Swap',
    description: 'Support, community, and bug-reporting channels for THORChain Swap.',
    url: `${AppConfig.baseUrl}/contact`,
    siteName: 'THORChain Swap',
    type: 'website'
  }
}

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  '@id': `${AppConfig.baseUrl}/contact#webpage`,
  name: 'Contact THORChain Swap',
  url: `${AppConfig.baseUrl}/contact`,
  isPartOf: { '@id': `${AppConfig.baseUrl}/#website` },
  mainEntity: { '@id': `${AppConfig.baseUrl}/#organization` }
}

export default function ContactPage() {
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      <article className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-txt-high-contrast text-3xl font-bold">Contact THORChain Swap</h1>
        <div className="text-txt-med-contrast mt-6 space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-txt-high-contrast text-xl font-semibold">Support</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Email:{' '}
                <a className="underline" href={`mailto:${AppConfig.supportEmail}`}>
                  {AppConfig.supportEmail}
                </a>
              </li>
              <li>
                <a className="underline" href={AppConfig.discordLink} rel="noopener noreferrer" target="_blank">
                  THORChain community Discord
                </a>
              </li>
              <li>
                <a className="underline" href={AppConfig.telegramLink} rel="noopener noreferrer" target="_blank">
                  THORChain Telegram
                </a>
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-txt-high-contrast text-xl font-semibold">Bugs and developer questions</h2>
            <p className="mt-3">
              Report reproducible interface issues through the in-app “Report a Bug” action or the public source repository. Do not include wallet
              secrets, private account data, or confidential credentials.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                <a className="underline" href="https://github.com/thorchain/swap.thorchain/issues" rel="noopener noreferrer" target="_blank">
                  GitHub issues
                </a>
              </li>
              <li>
                <Link className="underline" href="/developers">
                  Developer resources
                </Link>
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-txt-high-contrast text-xl font-semibold">Security warning</h2>
            <p className="mt-3 font-semibold">
              Never send anyone your seed phrase, private key, wallet backup, or signing credentials. Legitimate support will never ask for them.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
