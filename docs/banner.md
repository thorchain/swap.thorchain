# Announcement banner

The strip above the header is content, not code. It is written in the affiliate admin at
[affiliate.thorchain.org/banner](https://affiliate.thorchain.org/banner) — a page only admin accounts can reach — and this app reads it at runtime, so
putting one up, or taking it down, is a save rather than a deploy.

## How it reaches a visitor

```
admin /banner ──save──▶ data/banner.json ──▶ admin /api/banner
                                                   │  fetched at most every 30s
                                            swap /api/banner   ← this app, one cache for everyone
                                                   │  polled every 60s by each open tab
                                            <AnnouncementBanner />
```

Nothing about a swap depends on the banner, so it never competes with the requests that matter: the first fetch waits for the browser to go idle (at
most 3s), and the header renders without it until then. A published change is on screen within about a minute. Nothing is baked into the build: if the
admin cannot be reached this app keeps serving the last banner it saw, and a cold start with the admin down shows no banner at all rather than
resurrecting an old one.

`BANNER_API_URL` overrides where `src/app/api/banner/route.ts` reads from (default `https://affiliate.thorchain.org/api/banner`) — point it at a local
admin to work on the banner.

## What the editor controls

| Field      | Meaning                                             |
| ---------- | --------------------------------------------------- |
| Show       | The on/off switch. Off means nobody sees it.        |
| Headline   | Required. The bold first sentence.                  |
| Text       | Optional sentence after the headline.               |
| Link label | Optional. Rendered as a link when a URL is set too. |
| Link URL   | Optional, `https://` only.                          |
| Icon       | Optional. Upload an image.                          |

The icon (SVG, PNG, JPEG, WebP or GIF, under 512 KB) is stored beside the JSON in the admin and published at its `/api/banner/icon`, which this app
proxies at the same path — so `icon` is always a path on our own origin, never another host, and the `?v=` on it is a hash of the bytes, making it
cacheable forever. Publishing without choosing a file keeps the icon already in place; "Remove the icon" clears it.

## Languages

English is the only field you have to fill in. When the English copy changes, the admin sends it through the same model and rules as
`tools/i18n-translate.mjs` and stores a block per locale, so a banner goes out in all 24 languages without anyone typing them.

A collapsed **Languages** panel under the form holds every locale, for the cases the machine cannot cover — a correction from a native speaker, or a
language written by hand when no translation key is configured. Anything typed there is kept exactly as written, including when the same publish
changes the English and retranslates everything around it; clearing a language's headline drops it. A visitor gets their own locale merged over
English field by field, so a language nobody filled in still reads.

Banner copy is _not_ part of `src/i18n/messages` and never reaches the review queue — see [localization.md](localization.md) for the strings that are.

## Taking one down

Switching **Show the banner** off hides it while keeping the copy, so the same banner can go back up later. **Delete this banner** removes it outright
— the English, every translation and the icon — and leaves the admin with an empty form. Either way visitors stop seeing it within about a minute.

## Dismissal

Each banner carries an `id` the admin derives from the English copy and link. This app stores it as `localStorage['announcement-dismissed']` when a
visitor closes the banner, so a reworded banner is a new id and comes back for everyone, while switching the same one off and on does not.
