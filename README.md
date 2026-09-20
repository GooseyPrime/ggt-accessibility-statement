# Golden Goose Tools — Accessibility Statement

Free readiness score across the nine W3C accessibility-statement parts. Paid unlock: the same statement in plain text, HTML with correct headings, and a print view.

Accent: Signal steel `#8a9bb0`. Registry id: `a11y-statement`. Shop path: `/tools/accessibility-statement`.

**The shop registry `live` flag stays false until Brandon says otherwise.** This app can ship as a draft; it must not appear in the catalogue until a stranger can complete the product-brief acceptance test end to end.

## One-command local run

```bash
npm i && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For the shop path without `basePath`, use [http://localhost:3000/tools/accessibility-statement](http://localhost:3000/tools/accessibility-statement).

Copy `.env.example` to `.env.local` if you want shop origin, mirrored prices, or local unlock.

## What it does

1. Paste a site URL (messy trailing words are stripped) and, optionally, a real accessibility report (JSON, link, or token).
2. Free result: score `N/9` plus a checklist of which parts are filled and which still need an answer.
3. Paid result (after the shop confirms the sale): one page with text, HTML, and print. Known limitations come from the report only. Plan lines (“being fixed by”) are editable. The tool never invents barriers and never upgrades conformance.

Nine parts:

1. Site covered
2. Standard aimed at
3. Honest conformance status
4. How it was assessed
5. Known limitations, reasons, and alternatives
6. How to report a problem
7. Contact details
8. Date
9. How to ask for content in another format

The page says this is general information, not legal advice.

## Design kit

Chrome comes only from [`ggt-design-kit`](https://github.com/GooseyPrime/ggt-design-kit):

```json
"ggt-design-kit": "github:GooseyPrime/ggt-design-kit"
```

Fonts: Fraunces, IBM Plex Sans, IBM Plex Mono via `next/font`, as the kit README shows. `--ggt-accent: #8a9bb0`. No Tailwind. No other UI library.

## Shop payment handshake

This repository holds **no Stripe secrets**. Money stays in [GoldenGooseTools](https://github.com/GooseyPrime/GoldenGooseTools).

1. After the free score, the paywall POSTs `{SHOP}/api/sale` (falls back to `{SHOP}/api/checkout`) with `toolId` / `product` `a11y-statement`, the site URL, `withReport`, and a return URL.
2. The shop returns a checkout URL. The browser goes there.
3. On return, this page GET/POSTs `{SHOP}/api/verify` with `session_id`.
4. If the shop says `paid: true`, the three statement views unlock. The draft stays in `sessionStorage` so a refresh can rebuild it.

Prices are read from env that **mirror shop config**:

| Env | Role | Cos example only |
| --- | --- | --- |
| `NEXT_PUBLIC_SHOP_ORIGIN` | Shop origin | `https://www.goldengoosetools.com` |
| `NEXT_PUBLIC_PRICE_CENTS` | Alone price in cents | `2900` ($29) |
| `NEXT_PUBLIC_PRICE_WITH_REPORT_CENTS` | With-report price in cents | `1900` ($19) |

If those price keys are unset, the page does not invent a dollar figure.

Local development without a shop: set `NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK=true`. Checkout then returns to this page with `session_id=local`. Do not enable that in production.

This app also exposes `/api/sale` and `/api/verify` so the browser can talk to this origin; those routes only forward to the shop desk.

## Subpath deploy

The shop should route `goldengoosetools.com/tools/accessibility-statement` to this app.

- Standalone / local: leave `NEXT_PUBLIC_BASE_PATH` empty. `/` and `/tools/accessibility-statement` both render the tool.
- Shop subpath: set `NEXT_PUBLIC_BASE_PATH=/tools/accessibility-statement` so `next.config.ts` applies `basePath` and `assetPrefix`.

Keep registry `live: false` until Brandon turns it on.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

CI runs those three on every pull request.

Fixtures under `fixtures/`:

- `clean-marketing.html` — contact, email, phone
- `no-contact.html` — splash page with no a11y or contact facts
- `messy-url.txt` — trailing junk after a real URL
- `report-failing.json` / `report-fully-with-barriers.json` — never-upgrade cases

The score engine and conformance rules live in `lib/` as deterministic TypeScript. The page only renders them.

## Follow-ups for the shop (not this repo)

- Keep `a11y-statement` `live: false` until the stranger test passes.
- Confirm shop price keys for $29 / $19-with-report and CORS so this origin can call `/api/sale` and `/api/verify`.
- `/api/sale` must route `toolId=a11y-statement` to the statement SKU, not the $49 accessibility-check checkout.
- Wire Fix It For Me into `NEXT_PUBLIC_NEXT_TOOL_FIX` when that tool is listed.

Draft pull requests only. Brandon merges.
