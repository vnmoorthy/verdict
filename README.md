<div align="center">

# ⚖️ Verdict

### Point your camera at any used listing. Get a fair-price verdict, photo-grounded defects, and a scam read — in ~60 seconds.

*The model perceives. The code prices.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built with Google Gemini](https://img.shields.io/badge/Built%20with-Google%20Gemini-4285F4?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 5](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Runs on Replit](https://img.shields.io/badge/Runs%20on-Replit-F26207?logo=replit&logoColor=white)](https://replit.com/)

**[▶ Live demo](https://verdict-vnmoorthy.replit.app)** · [Gemini setup](./AISTUDIO.md) · [Report a bug](../../issues)

</div>

---

> _📸 Screenshot / GIF goes here — drop a `docs/demo.gif` and reference it: `![Verdict in action](docs/demo.gif)`_

---

## Why Verdict exists

Buying used is a market for "lemons." In [Akerlof's classic problem](https://en.wikipedia.org/wiki/The_Market_for_Lemons), the seller knows the item's flaws and the buyer doesn't — so the buyer either overpays or walks, and honest sellers get punished by the same suspicion as dishonest ones. Facebook Marketplace, Craigslist, and OfferUp turned that asymmetry into a daily tax: stock photos, vague descriptions, "firm on price," and outright scams.

Verdict narrows the gap. It looks at the **same photos the seller posted** and gives the buyer an appraiser's read — what it's worth, what's wrong with it, and whether the listing smells like a scam — before they message the seller or drive across town.

## What it does

Upload a listing's photos (add the asking price and description if you have them). Verdict returns three things:

1. **⚖️ A fair-price verdict** — a realistic used-resale range (low / typical / high) and a plain call: **overpriced**, **fair**, or **a deal**, with a suggested opening offer.
2. **🔍 Condition defects, grounded to the photos** — each flaw is tied to the specific image and a bounding box in it (repainted panel, curb rash, screen burn-in, missing parts), with a severity, a calibrated confidence, and the dollar impact on value.
3. **🚩 A scam / authenticity read** — signals like price-too-good-to-be-true anomalies, counterfeit tells, and stock-photo hints, rolled up into a low / medium / high risk with a one-line takeaway.

All of it in roughly a minute.

## 60-second Quickstart

```bash
git clone https://github.com/vnmoorthy/verdict.git
cd verdict
npm install
npm run dev
```

Open the local URL Vite prints (default http://localhost:5173).

- **DEMO mode is the default and needs no API key** — it runs the full flow on bundled sample listings so you can see exactly what Verdict produces.
- **LIVE mode** inspects your own photos. Paste a Google Gemini API key into the app (get one free at [Google AI Studio](https://aistudio.google.com/apikey)). The key is stored **only in your browser's `localStorage`** and is sent directly to Google — see [AISTUDIO.md](./AISTUDIO.md) for setup and the production-proxy note.

## How it works

`the model perceives, the code prices`

```
photos ──▶ 1. PERCEIVE ──▶ 2. VERIFY ──▶ 3. PRICE + SCORE ──▶ 4. REPORT
           (Gemini vision)  (calibrate)   (deterministic code)  (verdict)
```

1. **Perceive.** Gemini `gemini-3.5-flash` identifies the item and returns structured JSON: findings with photo index + bounding box, authenticity signals, and a raw fair-price range. Images are downscaled client-side before upload to keep inference fast.
2. **Verify.** Severities, confidences, and risk levels are normalized and sanity-checked so a stray or malformed field can't corrupt the result.
3. **Price & score — in code, not in the prompt.** The dollars are computed **deterministically in TypeScript**, not asked of the model: base value minus per-finding price impacts (`computeValuation`), an opening offer and negotiation talking points (`computeNegotiation`), and a price-anomaly scam signal that fires when the ask is implausibly below fair value (`priceAnomalySignal`, `maxRisk`). Same inputs → same numbers, every time. The model's job is to *see*; the code's job is to *decide*.
4. **Report.** Findings render as annotated boxes over the original photos, next to the verdict, the price range, and the scam summary.

**It refuses to make things up.** If the photos aren't a sellable item, Verdict stops rather than inventing an appraisal — it returns _"Couldn't read these photos as a sellable item. Try clearer, in-hand photos of one item."_ (`src/gemini.ts`). No item, no verdict.

## Built with

- **[Google Gemini](https://ai.google.dev/) (`gemini-3.5-flash`)** via **[Google AI Studio](https://aistudio.google.com/apikey)** and the `@google/genai` SDK — vision perception with strict JSON output. Full setup and key handling: **[AISTUDIO.md](./AISTUDIO.md)**.
- **[Replit](https://replit.com/)** — ships as a static build (`.replit` configured for `deploymentTarget = "static"`, `publicDir = "dist"`). Import the repo and hit Run.

## Honest limitations

Verdict is a **photo screen, not a full inspection.** Read it that way:

- **It only knows what the photos show.** No test drive, no OBD scan, no powering the device on, no touching or smelling the item. A clean-looking listing can still hide a bad engine, water damage, or a worn battery.
- **It is not provenance or a title/VIN check.** It does not verify ownership, liens, accident history, or serial numbers against any database.
- **It does not do reverse-image search.** It can flag "this looks like a stock photo," but it cannot prove an image was lifted from elsewhere on the web.
- **Prices are estimates, not appraisals.** They reflect general used-resale patterns, not your exact local market on a given day.
- **Confidence is a signal, not a guarantee.** Low-confidence findings are surfaced as "needs more angles," not hidden. Always confirm in person before paying.

Use it to walk in informed and negotiate — not as the final word.

## Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 5 |
| UI | React 18 + TypeScript 5 |
| AI | Google Gemini `gemini-3.5-flash` via `@google/genai` |
| Pricing / scam logic | Deterministic TypeScript (no server) |
| Deploy | Static build → Replit (or any static host) |

Zero backend. The app is a single-page client; your Gemini key and photos go straight from your browser to Google.

## Project structure

```
verdict/
├─ index.html            # Vite entry
├─ .replit               # static-deploy config (dist/)
├─ vite.config.ts
├─ AISTUDIO.md           # Gemini / AI Studio setup + key handling
├─ src/
│  ├─ main.tsx           # React bootstrap
│  ├─ App.tsx            # UI, upload flow, annotated report
│  ├─ engine.ts          # orchestrates demo vs. live run
│  ├─ gemini.ts          # live Gemini call + JSON parsing + non-item refusal
│  ├─ data.ts            # deterministic valuation, negotiation & scam scoring
│  ├─ image.ts           # client-side downscaling before upload
│  ├─ lib.ts             # helpers, key/mode storage
│  ├─ types.ts           # shared types
│  └─ index.css
└─ public/               # sample listing assets
```

## License

[MIT](./LICENSE) — do what you like, no warranty. Verdict is a decision aid, not professional appraisal, legal, or financial advice.

---

<div align="center">

**If Verdict saved you from a lemon — or just made a negotiation less awkward — ⭐ star the repo.** It genuinely helps.

</div>
