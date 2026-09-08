# Localization protocol

English is the source. Everything else is machine-translated from it and then improved by native speakers. This document is the contract between those
two halves: what the translator is allowed to touch, and what it must never touch.

## The two guarantees

**1. Locales are isolated.** `src/i18n/messages/en.json` is the only input to translation. No locale file is ever read as a source for another one, so
editing `zh.json` cannot change `en.json`, `ko.json`, or anything else. The only direction of flow is English → locale.

**2. Hand-written translations are never overwritten.** Once a person edits a value in a locale file, that key belongs to them. The translator leaves
it alone — on a normal run, and on `--all`. When the English behind such a key later changes, the human translation stays and the key is listed in
`tools/i18n-review-queue.json` for a native speaker to look at.

Both are covered by `npm run test:i18n`.

## How to improve a translation

Edit the value in `src/i18n/messages/<locale>.json` and open a PR. That is the whole process — no annotation, no flag, no separate file. The
translator detects the edit by itself.

Two things to keep intact, because they are structural rather than editorial:

- **Placeholders** — `{amount}`, `{ticker}`, `{chain}`, and friends. Keep every one of them, spelled exactly the same. Move them where the sentence
  needs them; never translate the text inside the braces.
- **Inline tags** — `<b>…</b>` must survive as-is.

Brand names (THORChain, THORName, RUNE, CACAO, Ledger, Trezor, asset tickers) normally stay in English, but that is an editorial call and a native
speaker overriding it is exactly the point of this process.

If a string is brand new and has never been translated, let the translator run first and then improve what it produced. A hand-written value added in
the same commit that introduces the English key cannot be distinguished from machine output yet, so it is not protected until the translator has seen
it once.

## How the protection works

`tools/i18n-state/<locale>.json` records, per key, the English the translation was made from and what the translator wrote:

```json
"menu.swap": ["Swap", "兑换"]
```

That second string is the whole detector. If `zh.json` still says `兑换`, the translator wrote it and may rewrite it. If it says anything else, a
person edited it, and the key is off limits from then on — there is no flag to set and nothing to remember, and the only way back is
`--overwrite-human`.

The first string is what makes staleness per locale: it is compared against today's English. Translating one locale never marks the others as up to
date, so `--locale de` is safe.

Hand-edited keys carry a third string — what was in the locale file at the last run — which is only used to tell a translation the reviewer has just
changed from one that has been sitting untouched:

```json
"menu.swap": ["Swap", "兑换", "交换"]
```

Comparing those strings to what is in the files today sorts every key into one of four buckets:

| Situation                        | What happens                    |
| -------------------------------- | ------------------------------- |
| Machine-owned, English unchanged | left alone                      |
| Machine-owned, English changed   | retranslated                    |
| Human-owned, English unchanged   | left alone                      |
| Human-owned, English changed     | **kept**, and queued for review |

## The review queue

When English moves under a hand-written translation, the run writes `tools/i18n-review-queue.json`:

```json
{
  "locales": {
    "zh": [
      {
        "key": "menu.swap",
        "reason": "english-changed",
        "englishWas": "Swap",
        "englishNow": "Swap now",
        "translation": "交换"
      }
    ]
  }
}
```

`reason` is one of:

- `english-changed` — the translation is stale. It stays in the queue until a person edits it.
- `edited-alongside-english` — both the translation and its English changed in the same window, so the order is unknowable. Reported once as a
  heads-up; the edit is trusted.
- `machine-revised-verify` — `--revise-human` updated it; worth a glance.

Editing the translation clears its entry on the next run. CI renders the whole queue into the workflow summary.

## Commands

```bash
npm run i18n:check      # what is untranslated, and what is awaiting review
npm run i18n:translate  # translate everything pending (needs I18N_API_KEY)
npm run test:i18n       # regression tests for the two guarantees
```

Flags on `node tools/i18n-translate.mjs`:

| Flag                | Effect                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--locale de,fr`    | limit the run to specific locales                                                                                                                                         |
| `--all`             | retranslate every machine-owned key; hand-written ones are still protected                                                                                                |
| `--revise-human`    | let the model update stale hand-written translations, instructed to make the smallest change that fits the new English and to keep the reviewer's wording everywhere else |
| `--overwrite-human` | drop all protection. Destructive; there is no reason to run this except a deliberate reset                                                                                |

`npm run i18n:check` fails only on genuinely untranslated strings. Keys waiting on a native speaker are reported but never fail the build — no machine
can clear them, so blocking on them would just be a permanently red check.

## CI

`.github/workflows/i18n.yml` runs on any push to `main` that touches `src/i18n/messages/**`, and commits the result back with `[skip ci]`. Pushing a
locale-only change is what records a reviewer's edits in the state files; that run makes no API calls unless something is actually untranslated.
