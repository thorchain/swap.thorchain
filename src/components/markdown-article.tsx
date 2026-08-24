import { Fragment, type ReactNode } from 'react'

// Minimal markdown renderer for the developer docs, whose markdown is authored
// in this repo (src/lib/agent/developer-docs.ts) and served verbatim at the
// matching .md URL. It covers exactly the subset those documents use —
// headings, paragraphs, bullet and numbered lists, fenced code, and inline
// code/bold/links — so one source produces both representations.

const INLINE_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) nodes.push(text.slice(cursor, index))

    const key = `${keyPrefix}-${index}`
    if (match[1]) nodes.push(<code key={key}>{match[1]}</code>)
    else if (match[2]) nodes.push(<strong key={key}>{match[2]}</strong>)
    else if (match[3])
      nodes.push(
        <a className="underline" href={match[4]} key={key} {...(match[4].startsWith('http') ? { rel: 'noopener noreferrer' } : {})}>
          {match[3]}
        </a>
      )

    cursor = index + match[0].length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

const HEADINGS = { '# ': 'h1', '## ': 'h2', '### ': 'h3' } as const

const HEADING_CLASS = {
  h1: 'text-txt-high-contrast text-3xl font-bold',
  h2: 'text-txt-high-contrast mt-10 text-xl font-semibold',
  h3: 'text-txt-high-contrast mt-6 text-base font-semibold'
}

export function MarkdownArticle({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    const text = paragraph.join(' ')
    blocks.push(
      <p className="text-txt-med-contrast mt-3 text-sm leading-relaxed" key={`p-${blocks.length}`}>
        {renderInline(text, `p${blocks.length}`)}
      </p>
    )
    paragraph = []
  }

  const flushList = () => {
    if (!list) return
    const ListTag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <ListTag
        className={`text-txt-med-contrast mt-3 space-y-1 pl-5 text-sm leading-relaxed ${list.ordered ? 'list-decimal' : 'list-disc'}`}
        key={`list-${blocks.length}`}
      >
        {list.items.map((item, index) => (
          <li key={index}>{renderInline(item, `li${blocks.length}-${index}`)}</li>
        ))}
      </ListTag>
    )
    list = null
  }

  for (let index = 0; index < lines.length; index++) {
    // Nested list items are rendered flat: the docs use indentation only to
    // group parameters under their tool, never for real nesting semantics.
    const line = lines[index].trimStart()

    if (line.startsWith('```')) {
      flushParagraph()
      flushList()
      const code: string[] = []
      index++
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++])
      blocks.push(
        <pre className="bg-sub-container-modal mt-3 overflow-x-auto rounded-lg border p-4 font-mono text-xs" key={`code-${blocks.length}`}>
          <code>{code.join('\n')}</code>
        </pre>
      )
      continue
    }

    const headingPrefix = (Object.keys(HEADINGS) as (keyof typeof HEADINGS)[]).find(prefix => line.startsWith(prefix))
    if (headingPrefix) {
      flushParagraph()
      flushList()
      const Tag = HEADINGS[headingPrefix]
      blocks.push(
        <Tag className={HEADING_CLASS[Tag]} key={`h-${blocks.length}`}>
          {renderInline(line.slice(headingPrefix.length), `h${blocks.length}`)}
        </Tag>
      )
      continue
    }

    if (line.startsWith('- ')) {
      flushParagraph()
      if (!list || list.ordered) {
        flushList()
        list = { ordered: false, items: [] }
      }
      list.items.push(line.slice(2))
      continue
    }

    const orderedMarker = line.indexOf('. ')
    if (orderedMarker > 0 && orderedMarker < 3 && !Number.isNaN(Number(line.slice(0, orderedMarker)))) {
      flushParagraph()
      if (!list || !list.ordered) {
        flushList()
        list = { ordered: true, items: [] }
      }
      list.items.push(line.slice(orderedMarker + 2))
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  return <Fragment>{blocks}</Fragment>
}
