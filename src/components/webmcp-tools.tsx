'use client'

import { useEffect } from 'react'

type WebMcpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input?: unknown) => Promise<unknown> | unknown
}

type ModelContext = {
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | (() => void)
}

declare global {
  // WebMCP moved its entry point to document.modelContext; the navigator alias
  // is deprecated from Chrome 150 on, so both are declared and document wins.
  interface Navigator {
    modelContext?: ModelContext
  }
  interface Document {
    modelContext?: ModelContext
  }
}

const publicRoutes: Record<string, string> = {
  swap: '/',
  pool: 'https://pool.thorchain.org/',
  bond: 'https://bond.thorchain.org/',
  memo: 'https://memo.thorchain.org/',
  tcy: 'https://tcy.thorchain.org/',
  thorname: 'https://thorname.thorchain.org/'
}

const PAGE_SECTIONS = ['page', 'discovery', 'all'] as const

function readSection(input: unknown) {
  if (!input || typeof input !== 'object' || !('include' in input)) return 'all'
  const include = (input as { include?: unknown }).include
  return typeof include === 'string' && (PAGE_SECTIONS as readonly string[]).includes(include) ? include : 'all'
}

function readRoute(input: unknown) {
  if (!input || typeof input !== 'object' || !('route' in input)) return 'swap'
  const route = (input as { route?: unknown }).route
  return typeof route === 'string' && route in publicRoutes ? route : 'swap'
}

export function WebMcpTools() {
  useEffect(() => {
    const modelContext = document.modelContext ?? navigator.modelContext
    if (!modelContext?.registerTool) return

    const controller = new AbortController()
    const unregisters: Array<() => void> = []

    const tools: WebMcpTool[] = [
      {
        name: 'get-thorchain-swap-page',
        description:
          'Return public metadata for the current THORChain Swap page: its identity, and where this site publishes agent discovery documents.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            include: {
              type: 'string',
              enum: [...PAGE_SECTIONS],
              default: 'all',
              description: 'Which half of the result to return: "page" for the page identity, "discovery" for the discovery URLs, "all" for both.'
            }
          }
        },
        execute: input => {
          const section = readSection(input)
          const page = { title: document.title, url: window.location.href, origin: window.location.origin }
          const discovery = {
            robots: `${window.location.origin}/robots.txt`,
            sitemap: `${window.location.origin}/sitemap.xml`,
            apiCatalog: `${window.location.origin}/.well-known/api-catalog`,
            agentSkills: `${window.location.origin}/.well-known/agent-skills/index.json`,
            mcpServerCard: `${window.location.origin}/.well-known/mcp/server-card.json`,
            developers: `${window.location.origin}/developers`
          }

          if (section === 'page') return page
          if (section === 'discovery') return { discovery }
          return { ...page, discovery }
        }
      },
      {
        name: 'open-thorchain-swap-route',
        description: 'Navigate to a stable public THORChain Swap route.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['route'],
          properties: {
            route: {
              type: 'string',
              enum: Object.keys(publicRoutes),
              description: 'Public route to open. Defaults to the swap interface when omitted or unknown.'
            }
          }
        },
        execute: input => {
          const route = readRoute(input)
          const target = publicRoutes[route]
          // Defer navigation so the tool result is delivered before the page unloads.
          setTimeout(() => window.location.assign(target), 0)
          return { route, url: target }
        }
      }
    ]

    for (const tool of tools) {
      try {
        const unregister = modelContext.registerTool(tool, { signal: controller.signal })
        if (typeof unregister === 'function') unregisters.push(unregister)
      } catch (error) {
        console.warn('[webmcp] Failed to register tool', tool.name, error)
      }
    }

    return () => {
      controller.abort()
      for (const unregister of unregisters) {
        try {
          unregister()
        } catch {
          // Already unregistered via the abort signal.
        }
      }
    }
  }, [])

  return null
}
