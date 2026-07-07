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
  interface Navigator {
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

function readRoute(input: unknown) {
  if (!input || typeof input !== 'object' || !('route' in input)) return 'swap'
  const route = (input as { route?: unknown }).route
  return typeof route === 'string' && route in publicRoutes ? route : 'swap'
}

export function WebMcpTools() {
  useEffect(() => {
    const modelContext = navigator.modelContext
    if (!modelContext?.registerTool) return

    const controller = new AbortController()
    const unregisters: Array<() => void> = []

    const tools: WebMcpTool[] = [
      {
        name: 'get-thorchain-swap-page',
        description: 'Return public metadata for the current THORChain Swap page.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {}
        },
        execute: () => ({
          title: document.title,
          url: window.location.href,
          origin: window.location.origin,
          discovery: {
            robots: `${window.location.origin}/robots.txt`,
            sitemap: `${window.location.origin}/sitemap.xml`,
            apiCatalog: `${window.location.origin}/.well-known/api-catalog`,
            agentSkills: `${window.location.origin}/.well-known/agent-skills/index.json`
          }
        })
      },
      {
        name: 'open-thorchain-swap-route',
        description: 'Navigate to a stable public THORChain Swap route.',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            route: {
              type: 'string',
              enum: Object.keys(publicRoutes),
              description: 'Public route to open.'
            }
          }
        },
        execute: (input) => {
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
