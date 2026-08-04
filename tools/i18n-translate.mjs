#!/usr/bin/env node
// Automatic UI translation.
//
// English (src/i18n/messages/en.json) is the single source of truth. This
// script fills in every other locale, translating only the strings that are
// new or whose English text changed since the last run — detected by diffing
// against a snapshot of the English base (tools/i18n-en-snapshot.json). Keys
// removed from English are pruned from the locale files, and output preserves
// English's key order so diffs stay small.
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
//   npm run i18n:check                               # report drift, no API calls, exit 1 if stale
//   node tools/i18n-translate.mjs --all              # retranslate every key (ignore the snapshot)
//   node tools/i18n-translate.mjs --locale de,fr     # limit to specific locales
//
// Env:
//   I18N_PROVIDER       anthropic (default) | openai | gemini
//   I18N_API_KEY        API key for the chosen provider (except with --check)
//   I18N_MODEL          model id override (defaults per provider, see PROVIDERS below)

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const MESSAGES_DIR = join(HERE, '..', 'src', 'i18n', 'messages')
const SNAPSHOT_PATH = join(HERE, 'i18n-en-snapshot.json')
const SOURCE_LOCALE = 'en'
const CHUNK_SIZE = 50

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
const localeArg = args.find((a, i) => args[i - 1] === '--locale')
const ONLY_LOCALES = localeArg ? new Set(localeArg.split(',').map((s) => s.trim())) : null

// ---- json helpers ---------------------------------------------------------

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + '\n')

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
  const files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json'))
  const locales = files.map((f) => f.slice(0, -'.json'.length)).filter((l) => l !== SOURCE_LOCALE)
  return ONLY_LOCALES ? locales.filter((l) => ONLY_LOCALES.has(l)) : locales
}

// ---- Claude ---------------------------------------------------------------

const SYSTEM_PROMPT = `You are a professional localizer for THORCHAIN Swap, a non-custodial crypto swap web app.

You will receive a JSON object mapping dotted keys to English UI strings. Return a JSON object with the SAME keys, whose values are the translated strings for the target language. Rules:

- Output ONLY the JSON object — no markdown, no code fences, no commentary.
- Preserve every placeholder exactly, unchanged and in a natural position: {amount}, {chain}, {ticker}, {name}, {mode}, {asset}, {app}, {percent}, {days}, {time}, {from}, {to}, {label}, {hint}, {protection}, etc. Never translate, rename, or reorder the text inside curly braces.
- Preserve inline HTML tags such as <b>...</b> exactly.
- Preserve leading/trailing whitespace and characters like the ellipsis (…) and newlines.
- Do NOT translate brand, protocol, or product names: THORChain, THORName, MAYAName, RUNE, CACAO, Maya, Ledger, Trezor, Discord, Swap (as the product tab), and asset tickers/symbols. Keep them as-is.
- Keep translations concise and idiomatic for buttons, labels, and tooltips in a financial UI.
- If a value is a URL, email, or pure symbol, return it unchanged.`

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
async function callAnthropic(userText) {
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': requireKey(), 'anthropic-version': '2023-06-01' },
    {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }]
    }
  )
  if (data.stop_reason === 'refusal') throw new Error('Model refused the translation request')
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

async function callOpenAI(userText) {
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${requireKey()}` },
    {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText }
      ]
    }
  )
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(userText) {
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    { 'x-goog-api-key': requireKey() },
    {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: { responseMimeType: 'application/json' }
    }
  )
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
}

const CALLERS = { anthropic: callAnthropic, openai: callOpenAI, gemini: callGemini }

async function translateChunk(pairs, langName, localeCode) {
  const input = Object.fromEntries(pairs)
  const userText =
    `Target language: ${langName} (locale code "${localeCode}").\n\n` +
    `Translate the values in this JSON object:\n${JSON.stringify(input, null, 2)}`

  const text = (await CALLERS[PROVIDER](userText)).trim()

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

// ---- main -----------------------------------------------------------------

async function main() {
  const en = readJson(join(MESSAGES_DIR, `${SOURCE_LOCALE}.json`))
  const enFlat = flatten(en)
  const enKeys = Object.keys(enFlat)

  const snapFlat = existsSync(SNAPSHOT_PATH) && !RETRANSLATE_ALL ? flatten(readJson(SNAPSHOT_PATH)) : {}
  // New or modified English strings since the last translation run.
  const changed = new Set(RETRANSLATE_ALL ? enKeys : enKeys.filter((k) => enFlat[k] !== snapFlat[k]))

  const locales = discoverLocales()
  const missingNames = locales.filter((l) => !LANGUAGES[l])
  if (missingNames.length) {
    console.error(`Missing LANGUAGES entry for: ${missingNames.join(', ')} (add them to tools/i18n-translate.mjs)`)
    process.exit(1)
  }

  let totalPending = 0
  const plan = []

  for (const locale of locales) {
    const path = join(MESSAGES_DIR, `${locale}.json`)
    const locFlat = existsSync(path) ? flatten(readJson(path)) : {}
    const pending = enKeys.filter((k) => !(k in locFlat) || changed.has(k))
    const removed = Object.keys(locFlat).filter((k) => !(k in enFlat))
    plan.push({ locale, path, locFlat, pending, removed })
    totalPending += pending.length
  }

  if (CHECK_ONLY) {
    let stale = false
    for (const { locale, pending, removed } of plan) {
      if (pending.length || removed.length) {
        stale = true
        console.log(`${locale}: ${pending.length} to translate, ${removed.length} to prune`)
      }
    }
    if (stale) {
      console.error('\nTranslations are out of date. Run: npm run i18n:translate')
      process.exit(1)
    }
    console.log('All translations are up to date.')
    return
  }

  console.log(`Provider: ${PROVIDER} | model: ${MODEL}`)
  console.log(`Locales: ${locales.length} | strings needing translation: ${totalPending}\n`)

  for (const { locale, path, locFlat, pending, removed } of plan) {
    if (pending.length === 0 && removed.length === 0) {
      console.log(`✓ ${locale} — up to date`)
      continue
    }
    const langName = LANGUAGES[locale]
    const translated = {}
    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE).map((k) => [k, enFlat[k]])
      process.stdout.write(`… ${locale} — translating ${i + 1}-${Math.min(i + CHUNK_SIZE, pending.length)} of ${pending.length}\r`)
      const result = await translateChunk(chunk, langName, locale)
      for (const [k] of chunk) if (typeof result[k] === 'string') translated[k] = result[k]
    }

    // Existing translations win for untouched keys; new/changed keys overwrite.
    const merged = { ...locFlat, ...translated }
    for (const k of Object.keys(merged)) if (!(k in enFlat)) delete merged[k]
    writeJson(path, buildNested(en, merged))
    console.log(`✓ ${locale} — +${Object.keys(translated).length} translated, -${removed.length} pruned` + ' '.repeat(20))
  }

  // Record the English we just translated from, so the next run only picks up
  // future changes. Only update when a full pass ran (no --locale filter).
  if (!ONLY_LOCALES) {
    writeJson(SNAPSHOT_PATH, en)
    console.log('\nUpdated English snapshot.')
  } else {
    console.log('\nSkipped snapshot update (--locale was used).')
  }
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
