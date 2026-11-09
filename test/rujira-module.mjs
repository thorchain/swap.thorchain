import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

// Exercise the actual TS dependency graph, including extensionless application imports.
export const loadRujiraModule = (name, overrides = {}) => {
  const cache = new Map()
  const load = url => {
    if (cache.has(url.href)) return cache.get(url.href).exports
    const module = { exports: {} }
    cache.set(url.href, module)
    const code = ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText
    const require = dependency => {
      if (dependency in overrides) return overrides[dependency]
      if (dependency === 'server-only') return {}
      if (dependency.startsWith('./')) return load(new URL(`${dependency}.ts`, url))
      return createRequire(url)(dependency)
    }
    runInThisContext(`(function(require, module, exports) {\n${code}\n})`, { filename: url.pathname })(require, module, module.exports)
    return module.exports
  }
  return load(new URL(`../src/lib/rujira/${name}.ts`, import.meta.url))
}
