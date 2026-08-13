#!/usr/bin/env node
// Automatic UI translation, with protection for hand-reviewed translations.
// The protocol is documented in docs/localization.md; the short version:
//
// English (src/i18n/messages/en.json) is the only input to translation, so
// editing zh.json can never change en.json or any other locale. Every other
// locale is filled in from it, translating only what is new or whose English
// changed, and output keeps English's key order so diffs stay small.
//
// A locale value that no longer matches what this script last wrote was edited
// by a human, and is never overwritten from then on — not by a normal run, not
// by --all. When English later changes underneath one, the translation is kept
// and the key is listed in tools/i18n-review-queue.json.
//
// Translation is done by an LLM, which handles the ICU-style {placeholders},
// <b> tags, brand terms, and the less common locales (Nigerian Pidgin,
// Egyptian Arabic, Lahnda, Runic transliteration) that generic translation
// APIs mishandle. Claude, OpenAI (GPT), and Google Gemini are supported.
//
// Usage:
//   I18N_API_KEY=sk-ant-... npm run i18n:translate
//   I18N_PROVIDER=openai I18N_API_KEY=sk-... npm run i18n:translate
//   I18N_PROVIDER=gemini I18N_API_KEY=... npm run i18n:translate
//   npm run i18n:check                               # report drift + review queue, no API calls
//   node tools/i18n-translate.mjs --all              # retranslate every machine-written key
//   node tools/i18n-translate.mjs --locale de,fr     # limit to specific locales
//   node tools/i18n-translate.mjs --revise-human     # let the model update stale human translations
//   node tools/i18n-translate.mjs --overwrite-human  # drop all protection (destructive)
//
// Env:
//   I18N_PROVIDER       anthropic (default) | openai | gemini
//   I18N_API_KEY        API key for the chosen provider (except with --check)
//   I18N_MODEL          model id override (defaults per provider, see PROVIDERS below)

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const MESSAGES_DIR = join(HERE, '..', 'src', 'i18n', 'messages')
const STATE_DIR = join(HERE, 'i18n-state')
const QUEUE_PATH = join(HERE, 'i18n-review-queue.json')
const SOURCE_LOCALE = 'en'
const CHUNK_SIZE = 50
const REVISE_CHUNK_SIZE = 25

// Supported LLM providers. Pick one with I18N_PROVIDER; override the model with
// I18N_MODEL. Each reads its own API key env var.
const PROVIDERS = {
  anthropic: { defaultModel: 'claude-opus-5' },
  openai: { defaultModel: 'gpt-4o' },
  gemini: { defaultModel: 'gemini-2.0-flash' }
}
const PROVIDER = (process.env.I18N_PROVIDER || 'anthropic').toLowerCase()
if (!PROVIDERS[PROVIDER]) {
  console.error(`Unknown I18N_PROVIDER "${PROVIDER}". Use one of: ${Object.keys(PROVIDERS).join(', ')}`)
  process.exit(1)
}
const MODEL = process.env.I18N_MODEL || PROVIDERS[PROVIDER].defaultModel

// Human-readable target descriptions for the translation prompt. Keys must
// cover every non-English locale that has a messages/<locale>.json file; the
// script errors if one is missing so new locales aren't silently skipped.
const LANGUAGES = {
  zh: 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese (Taiwan)',
  ko: 'Korean',
  ru: 'Russian',
  es: 'Spanish',
  fa: 'Persian (Farsi)',
  tr: 'Turkish',
  hi: 'Hindi',
  ar: 'Modern Standard Arabic',
  fr: 'French',
  bn: 'Bengali',
  pt: 'Portuguese',
  ja: 'Japanese',
  lah: 'Lahnda / Western Punjabi (Shahmukhi script)',
  ur: 'Urdu',
  id: 'Indonesian',
  de: 'German',
  it: 'Italian',
  pcm: 'Nigerian Pidgin (Naijá)',
  arz: 'Egyptian Arabic',
  vi: 'Vietnamese',
  th: 'Thai',
  'en-Runr': 'English transliterated letter-by-letter into Elder Futhark runes (ᚠᚢᚦᚨᚱᚲ)'
}

// ---- argv -----------------------------------------------------------------

const args = process.argv.slice(2)
const CHECK_ONLY = args.includes('--check')
const RETRANSLATE_ALL = args.includes('--all')
const REVISE_HUMAN = args.includes('--revise-human')
const OVERWRITE_HUMAN = args.includes('--overwrite-human')
const localeArg = args.find((a, i) => args[i - 1] === '--locale')
const ONLY_LOCALES = localeArg ? new Set(localeArg.split(',').map(s => s.trim())) : null

// ---- json helpers ---------------------------------------------------------

const readJson = p => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + '\n')

// State files get one key per line rather than JSON.stringify's four, so a
// changed string shows up as a one-line diff.
const writeState = (p, obj) => {
  const lines = Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: [${v.map(s => JSON.stringify(s)).join(', ')}]`)
  writeFileSync(p, `{\n${lines.join(',\n')}\n}\n`)
}

// Flatten nested strings to { "a.b.c": "text" }. Arrays are treated as leaves
// (there are none today, but this keeps it safe if one is added).
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

// Rebuild a locale object mirroring the English structure and key order.
// Only keys present in `enObj` are emitted (auto-prunes removed keys); each
// leaf takes its value from `flatValues`, falling back to English if absent.
function buildNested(enObj, flatValues, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(enObj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = buildNested(v, flatValues, key)
    } else {
      out[k] = key in flatValues ? flatValues[key] : v
    }
  }
  return out
}

// ---- locale discovery -----------------------------------------------------

function discoverLocales() {
  const files = readdirSync(MESSAGES_DIR).filter(f => f.endsWith('.json'))
  const locales = files.map(f => f.slice(0, -'.json'.length)).filter(l => l !== SOURCE_LOCALE)
  return ONLY_LOCALES ? locales.filter(l => ONLY_LOCALES.has(l)) : locales
}

// ---- model calls ----------------------------------------------------------

const SYSTEM_PROMPT = `You are a professional localizer for THORCHAIN Swap, a non-custodial crypto swap web app.

You will receive a JSON object mapping dotted keys to English UI strings. Return a JSON object with the SAME keys, whose values are the translated strings for the target language. Rules:

- Output ONLY the JSON object — no markdown, no code fences, no commentary.
- Preserve every placeholder exactly, unchanged and in a natural position: {amount}, {chain}, {ticker}, {name}, {mode}, {asset}, {app}, {percent}, {days}, {time}, {from}, {to}, {label}, {hint}, {protection}, etc. Never translate, rename, or reorder the text inside curly braces.
- Preserve inline HTML tags such as <b>...</b> exactly.
- Preserve leading/trailing whitespace and characters like the ellipsis (…) and newlines.
- Do NOT translate brand, protocol, or product names: THORChain, THORName, MAYAName, RUNE, CACAO, Maya, Ledger, Trezor, Discord, Swap (as the product tab), and asset tickers/symbols. Keep them as-is.
- Keep translations concise and idiomatic for buttons, labels, and tooltips in a financial UI.
- If a value is a URL, email, or pure symbol, return it unchanged.`

// Used with --revise-human: the existing translation was written or corrected
// by a native speaker, so the model updates it rather than replacing it.
const REVISE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

This is a REVISION pass. Each entry gives the previous English text, the new English text, and an existing translation that a native speaker wrote or corrected by hand. Produce an updated translation that:

- Makes the smallest change that brings the translation in line with the new English.
- Keeps the reviewer's wording, terminology, register, and punctuation everywhere the English did not change.
- Never reverts the reviewer's word choices to a more literal rendering of the English.

Return ONLY a JSON object mapping each key to its updated translation.`

function requireKey() {
  const key = process.env.I18N_API_KEY
  if (!key) throw new Error(`I18N_API_KEY is not set (required for I18N_PROVIDER=${PROVIDER})`)
  return key
}

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`${PROVIDER} API ${res.status}: ${await res.text()}`)
  return res.json()
}

// Each provider returns the model's raw text output for a user prompt.
async function callAnthropic(system, userText) {
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': requireKey(), 'anthropic-version': '2023-06-01' },
    {
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: userText }]
    }
  )
  if (data.stop_reason === 'refusal') throw new Error('Model refused the translation request')
  return (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
}

async function callOpenAI(system, userText) {
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${requireKey()}` },
    {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText }
      ]
    }
  )
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(system, userText) {
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    { 'x-goog-api-key': requireKey() },
    {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: 'application/json' }
    }
  )
  return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')
}

const CALLERS = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini }

async function askForJson(system, userText, localeCode) {
  const text = (await CALLERS[PROVIDER](system, userText)).trim()

  let jsonText = text
  if (jsonText.startsWith('```')) {
    // Strip a leading ```json / ``` fence and the trailing ``` fence.
    jsonText = jsonText.slice(jsonText.indexOf('\n') + 1)
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, jsonText.lastIndexOf('```'))
    jsonText = jsonText.trim()
  }

  try {
    return JSON.parse(jsonText)
  } catch {
    throw new Error(`Could not parse model output as JSON for ${localeCode}:\n${text.slice(0, 500)}`)
  }
}

function translateChunk(pairs, langName, localeCode) {
  const input = Object.fromEntries(pairs)
  return askForJson(
    SYSTEM_PROMPT,
    `Target language: ${langName} (locale code "${localeCode}").\n\n` +
      `Translate the values in this JSON object:\n${JSON.stringify(input, null, 2)}`,
    localeCode
  )
}

function reviseChunk(entries, langName, localeCode) {
  const input = Object.fromEntries(entries.map(e => [e.key, { englishWas: e.englishWas, englishNow: e.englishNow, reviewedTranslation: e.current }]))
  return askForJson(
    REVISE_SYSTEM_PROMPT,
    `Target language: ${langName} (locale code "${localeCode}").\n\n` +
      `Update each reviewed translation to match its new English:\n${JSON.stringify(input, null, 2)}`,
    localeCode
  )
}

// ---- per-locale planning --------------------------------------------------

// Decide, for one locale, which keys the script may rewrite and which are
// hand-written and therefore off limits.
//
// State per key is [english it was translated from, what the translator
// wrote], plus, once a person has edited the value, [, what was there at the
// last run]. A locale value that no longer equals the second entry was edited
// by a person — that is the whole human-edit detector, and it needs no
// annotation from reviewers. The third entry only distinguishes a translation
// a reviewer has just changed from one that has been sitting untouched.
function planLocale(locale, enFlat, enKeys) {
  const path = join(MESSAGES_DIR, `${locale}.json`)
  const locFlat = existsSync(path) ? flatten(readJson(path)) : {}
  const statePath = join(STATE_DIR, `${locale}.json`)
  const seeding = !existsSync(statePath)
  const state = seeding ? {} : readJson(statePath)

  const pending = [] // machine-owned keys to (re)translate
  const stale = [] // human-owned keys whose English moved on
  const touched = [] // human-owned keys edited in the same window as the English
  const nextState = {} // rebuilt in English key order; drops keys English removed

  for (const key of enKeys) {
    const english = enFlat[key]
    const current = locFlat[key]
    const prev = state[key]

    if (typeof current !== 'string') {
      pending.push(key) // missing entirely
      continue
    }

    if (!prev) {
      // Never seen before: adopt whatever is there as machine output.
      nextState[key] = [english, current]
      continue
    }

    const [translatedFrom, machine, seen] = prev
    const human = current !== machine
    const englishChanged = translatedFrom !== english

    if (human ? OVERWRITE_HUMAN : RETRANSLATE_ALL || englishChanged) {
      pending.push(key)
      continue
    }

    if (!human) {
      nextState[key] = prev
      continue
    }

    if (englishChanged && seen === current) {
      // Untouched since the last run, so nobody has looked at it yet. Keep the
      // pinned English, so the key stays queued until a person acts.
      stale.push(key)
      nextState[key] = [translatedFrom, machine, current]
      continue
    }

    // The reviewer has just changed this, so take it as written against
    // today's English. If the English moved in the same window there is no way
    // to tell in which order, so surface it once for a second look.
    if (englishChanged) touched.push(key)
    nextState[key] = [english, machine, current]
  }

  return {
    locale,
    path,
    statePath,
    locFlat,
    state,
    seeding,
    pending,
    stale,
    removed: Object.keys(locFlat).filter(k => !(k in enFlat)),
    nextState,
    review: [...stale, ...touched].map(key => ({
      key,
      reason: stale.includes(key) ? 'english-changed' : 'edited-alongside-english',
      englishWas: state[key][0],
      englishNow: enFlat[key],
      translation: locFlat[key]
    }))
  }
}

// ---- main -----------------------------------------------------------------

async function main() {
  if (OVERWRITE_HUMAN && REVISE_HUMAN) {
    console.error('--overwrite-human and --revise-human are mutually exclusive.')
    process.exit(1)
  }

  const en = readJson(join(MESSAGES_DIR, `${SOURCE_LOCALE}.json`))
  const enFlat = flatten(en)
  const enKeys = Object.keys(enFlat)

  const locales = discoverLocales()
  const missingNames = locales.filter(l => !LANGUAGES[l])
  if (missingNames.length) {
    console.error(`Missing LANGUAGES entry for: ${missingNames.join(', ')} (add them to tools/i18n-translate.mjs)`)
    process.exit(1)
  }

  // Carried forward so a --locale run doesn't drop other locales' entries.
  const prevQueue = existsSync(QUEUE_PATH) ? readJson(QUEUE_PATH).locales || {} : {}
  const plan = locales.map(l => planLocale(l, enFlat, enKeys))
  const totalPending = plan.reduce((n, p) => n + p.pending.length, 0)
  const totalReview = plan.reduce((n, p) => n + p.review.length, 0)

  if (CHECK_ONLY) {
    let stale = false
    for (const { locale, pending, removed } of plan) {
      if (pending.length || removed.length) {
        stale = true
        console.log(`${locale}: ${pending.length} to translate, ${removed.length} to prune`)
      }
    }
    if (totalReview) {
      // Reviewed translations only a person can update — reported, never fatal.
      console.log(`\n${totalReview} reviewed translation(s) need a native speaker's attention:`)
      for (const { locale, review } of plan) {
        if (review.length) console.log(`  ${locale}: ${review.map(r => r.key).join(', ')}`)
      }
      console.log('See tools/i18n-review-queue.json after the next translation run.')
    }
    if (stale) {
      console.error('\nTranslations are out of date. Run: npm run i18n:translate')
      process.exit(1)
    }
    if (!totalReview) console.log('All translations are up to date.')
    return
  }

  console.log(`Provider: ${PROVIDER} | model: ${MODEL}`)
  console.log(`Locales: ${locales.length} | strings needing translation: ${totalPending}`)
  if (OVERWRITE_HUMAN) console.log('!! --overwrite-human: hand-written translations will be replaced')
  console.log()

  mkdirSync(STATE_DIR, { recursive: true })
  const queue = { ...prevQueue }

  for (const p of plan) {
    const { locale, path, statePath, locFlat, state, seeding, pending, removed, nextState, stale } = p
    const langName = LANGUAGES[locale]
    const written = {}

    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE).map(k => [k, enFlat[k]])
      const upto = Math.min(i + CHUNK_SIZE, pending.length)
      process.stdout.write(`… ${locale} — translating ${i + 1}-${upto} of ${pending.length}\r`)
      const result = await translateChunk(chunk, langName, locale)
      for (const [k] of chunk) {
        if (typeof result[k] === 'string') {
          written[k] = result[k]
          nextState[k] = [enFlat[k], result[k]]
        } else {
          // The model skipped this key, so the file keeps what it had (or falls
          // back to English). Record that value or the next run mistakes it for
          // a hand edit; the null source never matches, so the key is retried.
          nextState[k] = [null, typeof locFlat[k] === 'string' ? locFlat[k] : enFlat[k]]
        }
      }
    }

    const revisedKeys = new Set()
    if (REVISE_HUMAN && stale.length) {
      const entries = stale.map(k => ({
        key: k,
        englishWas: state[k][0],
        englishNow: enFlat[k],
        current: locFlat[k]
      }))
      for (let i = 0; i < entries.length; i += REVISE_CHUNK_SIZE) {
        const chunk = entries.slice(i, i + REVISE_CHUNK_SIZE)
        const upto = Math.min(i + REVISE_CHUNK_SIZE, entries.length)
        process.stdout.write(`… ${locale} — revising ${i + 1}-${upto} of ${entries.length}\r`)
        const result = await reviseChunk(chunk, langName, locale)
        for (const e of chunk) {
          if (typeof result[e.key] !== 'string') continue
          written[e.key] = result[e.key]
          // Keep the original machine text, so the revision — which carries the
          // reviewer's wording — stays human-owned and protected.
          nextState[e.key] = [enFlat[e.key], state[e.key][1]]
          revisedKeys.add(e.key)
        }
      }
      // Report the revisions instead of the staleness they resolved.
      for (const item of p.review) {
        if (item.reason === 'english-changed' && revisedKeys.has(item.key)) {
          item.reason = 'machine-revised-verify'
          item.translation = written[item.key]
        }
      }
    }

    if (p.review.length) queue[locale] = p.review
    else delete queue[locale]

    // Existing values win for untouched keys; only keys this run wrote change.
    const merged = { ...locFlat, ...written }
    for (const k of Object.keys(merged)) if (!(k in enFlat)) delete merged[k]
    writeJson(path, buildNested(en, merged))
    writeState(statePath, nextState)

    const translated = Object.keys(written).length - revisedKeys.size
    const parts = []
    if (translated) parts.push(`+${translated} translated`)
    if (revisedKeys.size) parts.push(`~${revisedKeys.size} revised`)
    if (removed.length) parts.push(`-${removed.length} pruned`)
    if (p.review.length) parts.push(`${p.review.length} awaiting review`)
    if (seeding) parts.push('state seeded')
    console.log(`✓ ${locale} — ${parts.length ? parts.join(', ') : 'up to date'}`.padEnd(72))
  }

  if (Object.keys(queue).length) {
    writeJson(QUEUE_PATH, {
      note: 'Hand-reviewed translations whose English source has changed. These were NOT overwritten — a native speaker should confirm or update them in src/i18n/messages/<locale>.json.',
      generated: new Date().toISOString(),
      locales: queue
    })
    const queued = Object.values(queue).reduce((n, items) => n + items.length, 0)
    console.log(`\n${queued} reviewed translation(s) awaiting a native speaker — see tools/i18n-review-queue.json`)
  } else if (existsSync(QUEUE_PATH)) {
    rmSync(QUEUE_PATH)
  }
}

main().catch(err => {
  console.error('\n' + err.message)
  process.exit(1)
})
