import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppConfig } from '@/config'
import { MarkdownArticle } from '@/components/markdown-article'
import { DEVELOPER_DOCS, developerDocBySlug } from '@/lib/agent/developer-docs'

// Named developer resources at /developers/<topic>, each with a markdown twin
// at /developers/<topic>.md (served by src/proxy.ts). Content comes from
// src/lib/agent/developer-docs.ts, so the two representations cannot drift.

export function generateStaticParams() {
  return DEVELOPER_DOCS.map(doc => ({ topic: doc.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const doc = developerDocBySlug.get((await params).topic)
  if (!doc) return {}

  const url = `${AppConfig.baseUrl}/developers/${doc.slug}`
  return {
    title: doc.title,
    description: doc.description,
    keywords: doc.keywords,
    alternates: {
      canonical: url,
      types: { 'text/markdown': `${url}.md` }
    },
    openGraph: {
      title: doc.title,
      description: doc.description,
      url,
      siteName: 'THORChain Swap',
      type: 'article'
    }
  }
}

export default async function DeveloperDocPage({ params }: { params: Promise<{ topic: string }> }) {
  const doc = developerDocBySlug.get((await params).topic)
  if (!doc) notFound()

  const url = `${AppConfig.baseUrl}/developers/${doc.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${url}#webpage`,
    name: doc.navTitle,
    headline: doc.title,
    url,
    description: doc.description,
    isPartOf: { '@id': `${AppConfig.baseUrl}/#website` },
    about: { '@id': `${AppConfig.baseUrl}/developers#webapi` },
    publisher: { '@id': `${AppConfig.baseUrl}/#organization` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'THORChain Swap', item: AppConfig.baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Developer Resources', item: `${AppConfig.baseUrl}/developers` },
        { '@type': 'ListItem', position: 3, name: doc.navTitle, item: url }
      ]
    }
  }

  return (
    <main className="bg-body min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <Link href="/" className="text-txt-high-contrast text-sm font-semibold">
            THORChain Swap
          </Link>
          <Link href="/developers" className="text-txt-med-contrast text-sm underline">
            All developer resources
          </Link>
        </div>
      </header>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="container mx-auto max-w-3xl px-4 py-10" lang="en">
        <nav className="text-txt-med-contrast text-xs">
          <Link className="underline" href="/developers">
            THORChain Swap developer resources
          </Link>{' '}
          / {doc.navTitle}
        </nav>

        <MarkdownArticle markdown={doc.markdown} />

        <p className="text-txt-med-contrast mt-10 text-xs">
          This page as markdown:{' '}
          <a className="underline" href={`/developers/${doc.slug}.md`}>
            /developers/{doc.slug}.md
          </a>
        </p>

        <nav className="mt-6 border-t pt-6">
          <h2 className="text-txt-high-contrast text-sm font-semibold">More THORChain Swap developer resources</h2>
          <ul className="text-txt-med-contrast mt-3 list-disc space-y-1 pl-5 text-sm">
            {DEVELOPER_DOCS.filter(other => other.slug !== doc.slug).map(other => (
              <li key={other.slug}>
                <Link className="underline" href={`/developers/${other.slug}`}>
                  {other.navTitle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </main>
  )
}
