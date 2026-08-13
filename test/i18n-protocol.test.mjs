#!/usr/bin/env node
// Regression tests for the localization protocol (docs/localization.md), i.e.
// the two properties from issue #101:
//   1. Editing one locale never changes English or any other locale.
//   2. A translation improved by hand is never overwritten by the translator.
//
// Runs in a throwaway copy of the repo layout with the model call stubbed, so
// no repo file is touched and no API key is needed:  npm run test:i18n

import { cpSync, rmSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

// A sandbox mirroring the paths the tool resolves relative to its own file.
const SANDBOX = mkdtempSync(join(tmpdir(), 'i18n-protocol-'))
const MSG = join(SANDBOX, 'src', 'i18n', 'messages')
const TOOLS = join(SANDBOX, 'tools')
const STATE = join(TOOLS, 'i18n-state')
const QUEUE = join(TOOLS, 'i18n-review-queue.json')

mkdirSync(MSG, { recursive: true })
mkdirSync(TOOLS, { recursive: true })
cpSync(join(REPO, 'tools', 'i18n-translate.mjs'), join(TOOLS, 'i18n-translate.mjs'))

const readJson = p => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n')

// A miniature message set: one locale to poke at, one to prove isolation.
writeJson(join(MSG, 'en.json'), {
  menu: { swap: 'Swap', pool: 'Pool', language: 'Language' },
  swap: { cta: 'Swap {amount} {ticker}' }
})
writeJson(join(MSG, 'zh.json'), {
  menu: { swap: '兑换', pool: 'Pool', language: '语言' },
  swap: { cta: '兑换 {amount} {ticker}' }
})
writeJson(join(MSG, 'ko.json'), {
  menu: { swap: '스왑', pool: 'Pool', language: '언어' },
  swap: { cta: '{amount} {ticker} 스왑' }
})

// Stub model, patched into global fetch by a wrapper that then imports the
// tool. It answers "[MT] <english>" for a translation and "[REVISED] <existing>"
// for a revision, so every write is traceable to the path that produced it.
const runner = join(SANDBOX, 'run.mjs')
const stub = (skip = '') => `
globalThis.fetch = async (url, init) => {
  const sent = JSON.parse(init.body).messages[0].content
  const asked = JSON.parse(sent.slice(sent.indexOf('{')))
  const out = {}
  for (const [k, v] of Object.entries(asked)) {
    if (k === ${JSON.stringify(skip)}) continue
    out[k] = typeof v === 'string' ? '[MT] ' + v : '[REVISED] ' + v.reviewedTranslation
  }
  return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(out) }] }) }
}
await import(${JSON.stringify(join(TOOLS, 'i18n-translate.mjs'))})
`

function run(...args) {
  const skip = typeof args[0] === 'object' ? args.shift().skip : ''
  writeFileSync(runner, stub(skip))
  try {
    return execFileSync('node', [runner, ...args], {
      env: { ...process.env, I18N_API_KEY: 'stub', I18N_PROVIDER: 'anthropic' },
      encoding: 'utf8'
    })
  } catch (e) {
    // --check exits 1 when translations are stale; that is an expected result.
    return (e.stdout || '') + (e.stderr || '')
  }
}

let failures = 0
function check(name, cond, detail = '') {
  console.log(`${cond ? '  ok' : 'FAIL'}  ${name}${cond ? '' : ` — got ${JSON.stringify(detail)}`}`)
  if (!cond) failures++
}

const en = () => readJson(join(MSG, 'en.json'))
const zh = () => readJson(join(MSG, 'zh.json'))
const ko = () => readJson(join(MSG, 'ko.json'))
const zhState = () => readJson(join(STATE, 'zh.json'))
const queue = () => (existsSync(QUEUE) ? readJson(QUEUE) : { locales: {} })
const queued = (locale, key) => (queue().locales?.[locale] || []).some(r => r.key === key)

const setEn = (path, value) => {
  const o = en()
  const [a, b] = path.split('.')
  o[a][b] = value
  writeJson(join(MSG, 'en.json'), o)
}
const setZh = (path, value) => {
  const o = zh()
  const [a, b] = path.split('.')
  o[a][b] = value
  writeJson(join(MSG, 'zh.json'), o)
}

try {
  // Seeding adopts existing translations as machine output, unchanged.
  run()
  check('seeding leaves locale files untouched', zh().menu.swap === '兑换', zh().menu.swap)
  check('seeding writes per-locale state', existsSync(join(STATE, 'zh.json')) && existsSync(join(STATE, 'ko.json')))

  // 1. A hand edit in zh must not reach English or any other locale.
  setZh('menu.swap', '交换（人工润色）')
  run()
  check('hand-edited value survives a normal run', zh().menu.swap === '交换（人工润色）', zh().menu.swap)
  check('state still holds the machine text it diverged from', zhState()['menu.swap'][1] === '兑换', zhState()['menu.swap'])
  check('English is unaffected by the zh edit', en().menu.swap === 'Swap', en().menu.swap)
  check('Korean is unaffected by the zh edit', ko().menu.swap === '스왑', ko().menu.swap)

  // 2. Protection — English changes underneath a hand-edited key.
  setEn('menu.swap', 'Swap now')
  const checkOut = run('--check')
  check('--check surfaces the key for review', checkOut.includes('menu.swap'), checkOut)
  check('--check does not treat it as untranslated', !checkOut.split('\n').some(l => l.startsWith('zh: ')), checkOut)

  run('--locale', 'zh')
  check('hand edit survives an English change', zh().menu.swap === '交换（人工润色）', zh().menu.swap)
  check('the key lands in the review queue', queued('zh', 'menu.swap'))
  const item = queue().locales.zh.find(r => r.key === 'menu.swap')
  check('the queue records both English versions', item.englishWas === 'Swap' && item.englishNow === 'Swap now', item)
  run('--locale', 'zh')
  check('it stays queued until a person acts', queued('zh', 'menu.swap'))

  // 3. --all must not be a way to lose hand-written work.
  run('--all', '--locale', 'zh')
  check('--all leaves the hand edit alone', zh().menu.swap === '交换（人工润色）', zh().menu.swap)
  check('--all still retranslates machine keys', zh().swap.cta === '[MT] Swap {amount} {ticker}', zh().swap.cta)

  // 4. --revise-human updates a stale hand translation without discarding it.
  run('--revise-human', '--locale', 'zh')
  check('--revise-human revises rather than replaces', zh().menu.swap === '[REVISED] 交换（人工润色）', zh().menu.swap)
  check('the revision stays human-owned', zhState()['menu.swap'][1] === '兑换', zhState()['menu.swap'])
  run('--locale', 'zh')
  check('the queue entry clears after revision', !queued('zh', 'menu.swap'))

  // 5. A reviewer updating a queued key clears it, so no backlog builds up.
  setEn('menu.language', 'App language')
  setZh('menu.language', '语言（人工）')
  run('--locale', 'zh')
  check('a fresh reviewer edit is kept', zh().menu.language === '语言（人工）', zh().menu.language)
  run('--locale', 'zh')
  check('and does not linger in the queue', !queued('zh', 'menu.language'))

  // 6. A --locale run must not drop other locales' queue entries.
  setZh('menu.pool', '资金池（人工）')
  run('--locale', 'zh')
  setEn('menu.pool', 'Pools')
  run('--locale', 'zh')
  check('zh is queued', queued('zh', 'menu.pool'))
  run('--locale', 'ko')
  check('a ko-only run keeps zh in the queue', queued('zh', 'menu.pool'))

  // 6b. A translation that legitimately matches English is not churned.
  run('--all', '--locale', 'ko')
  const koPool = JSON.stringify(readJson(join(STATE, 'ko.json'))['menu.pool'])
  run('--locale', 'ko')
  check('a translation equal to English stays stable', JSON.stringify(readJson(join(STATE, 'ko.json'))['menu.pool']) === koPool)

  // 7. A key the model skips keeps its old text and gets retried.
  setEn('swap.cta', 'Swap {amount} {ticker} now')
  const before = zh().swap.cta
  run({ skip: 'swap.cta' }, '--locale', 'zh')
  check('a skipped key keeps its previous translation', zh().swap.cta === before, zh().swap.cta)
  const retryOut = run('--check')
  check('a skipped key is still reported as pending', retryOut.includes('zh: 1 to translate'), retryOut)

  // 8. The documented escape hatch does what it says.
  run('--overwrite-human', '--locale', 'zh')
  check('--overwrite-human replaces hand edits', zh().menu.swap === '[MT] Swap now', zh().menu.swap)
} catch (err) {
  console.log(`FAIL  the test harness threw — ${err.message}`)
  failures++
} finally {
  rmSync(SANDBOX, { recursive: true, force: true })
  console.log(failures ? `\n${failures} failure(s)` : '\nAll localization protocol checks passed')
  process.exit(failures ? 1 : 0)
}
