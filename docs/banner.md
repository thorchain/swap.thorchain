# Announcement banner

The strip above the header (`src/components/announcement-banner.tsx`) is configured from one file, `src/content/banner.json`, and baked in at build
time. There is no admin panel and no runtime fetch: change the file, merge, and the next deploy shows the new banner. Only one banner is live at a
time.

```json
{
  "enabled": true,
  "id": "monero-soon",
  "icon": "/networks/xmr.svg",
  "href": "",
  "locales": {
    "en": {
      "title": "Monero will be ready for trading soon.",
      "text": "XMR swaps are coming to THORChain — stay tuned."
    },
    "de": {
      "title": "Monero ist bald handelbar.",
      "text": "XMR-Swaps kommen zu THORChain – bleib dran."
    }
  }
}
```

| Field     | Meaning                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `enabled` | `false` hides the banner entirely. Everything else can stay as-is.                  |
| `id`      | The dismissal marker — change it whenever the copy changes (see below).             |
| `icon`    | Path to an image under `public/` (`""` for no icon). Rendered at 20×20 and rounded. |
| `href`    | Optional URL. Shown as a trailing link only when the copy also has a `link` label.  |
| `locales` | The text per locale. Only the `en` block is written by hand — see below.            |

Each block takes a required `title` and optional `text` and `link`. A visitor gets their own locale's block over the English one, field by field, so a
missing or half-filled translation still reads. The banner renders nothing at all if there is no English `title` — a typo fails quietly instead of
printing across the header.

## Putting up a new banner

1. Give it a **new `id`**, write the English copy, and **delete the other locale blocks**:

   ```json
   {
     "enabled": true,
     "id": "runepool-live",
     "icon": "/networks/thor.svg",
     "href": "https://docs.thorchain.org/…",
     "locales": {
       "en": { "title": "RUNEPool is live.", "text": "Deposit RUNE and earn from every swap.", "link": "Learn more" }
     }
   }
   ```

   Clearing the old translations is what stops non-English visitors seeing the previous banner's text in the minutes between your merge and the
   translation run; with only `en` present they see English until the rest lands.

2. Merge to `main`. The translation workflow fills the other 23 locales into this same file and commits them back (`.github/workflows/i18n.yml`).
   Banner copy goes through exactly the same pipeline as `src/i18n/messages/en.json`, including the protection for hand-corrected translations — see
   [localization.md](localization.md).

**Always use a fresh `id`.** Dismissal is stored per visitor as `localStorage['announcement-dismissed'] = <id>`, so reusing an old `id` means everyone
who dismissed the old banner never sees the new one.

## Turning it off

```json
"enabled": false
```

Leave the rest in place; nothing else needs to change.
