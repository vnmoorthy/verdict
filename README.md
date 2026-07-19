# Verdict — don't get played on Marketplace

**Run this before you drive out or send a cent.** Upload any used listing's photos and the asking price —
car, phone, couch, sneakers — and Verdict inspects it like a pro: the **fair price**, what's **wrong with
it**, and whether it's a **scam**. In 60 seconds.

Built at the Stanford × DeepMind "Build with Google Gemini" hackathon (Jul 19, 2026). One engine, any item;
cars are the flagship vertical (with real comps), and the same pipeline generalizes across Marketplace.

## What it does

1. **Perception** — Gemini multimodal reads 1-8 listing photos (+ optional listing text) and returns
   structured findings: the item, defects with severity + calibrated confidence + a bounding region, and a
   realistic used-resale price range.
2. **Verify** — an adversarial second pass re-examines every material finding and drops unsupported ones.
3. **Scam & authenticity** — flags the classic Marketplace tells: price far below market (deterministic,
   computed in code), stock/press-looking photos, missing verification shots, deposit/shipping-only
   patterns → a risk level with specific signals.
4. **Valuation** — deterministic math in code, never the model's guess: cars use median comps + mileage
   adjustment + per-finding attribution; other items use the model's fair range with its reasoning shown.
5. **Negotiation** — opening offer, target price, and a copy-paste script seeded with the strongest findings.

Honesty rails: built-in samples are stamped **"Sample report"**; your own photos only ever run through live
Gemini (never canned results); a high-scam item never renders as a green "great deal" (the low price is
framed as bait); photos that aren't a sellable item are rejected, not invented into a fake report; and the
report states what photos can't show (engine internals, structural damage).

## Built with

### Google AI Studio · Gemini
Verdict's perception runs on **Google Gemini** (`gemini-3.5-flash`), accessed through the **Google
AI Studio** API. We prototyped and tuned the inspection prompts in AI Studio's playground, then call
the Gemini API at runtime via `@google/genai` for multimodal photo analysis + an adversarial verify
pass. Pricing and negotiation are deterministic TypeScript — the model perceives, the code prices.
See [`AISTUDIO.md`](AISTUDIO.md) for the exact prompts, model config, and how to reproduce them in AI Studio.

### Replit
Verdict is a first-class **Replit** project — the included `.replit` config means you import the repo,
hit **Run** (Vite dev preview), and **Deploy → Static** to ship the live app, no extra setup. The
Gemini key is set via Replit **Secrets** (`VITE_GEMINI_API_KEY`), or each visitor pastes their own in-app.

### About the STANFORDDEEP code
`STANFORDDEEP` is the hackathon **promo / credit code** — redeemed **on the platform** (Replit / Google
Cloud credits) to run and deploy the project. It's a billing credit, not part of the app: it is not
hardcoded, embedded, or referenced anywhere in the source.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Zero-setup path: click **"Sample: used car"** (comps-grounded $4,150 overpay report) or
**"Sample: Marketplace scam"** (a high-scam iPhone listing) — both deterministic, no key needed.

Live path (inspect your own car): open **Settings**, paste a Gemini API key
(get one at https://aistudio.google.com/apikey — stored only in your browser's localStorage),
then add photos + asking price and hit **Inspect this car**.

Optionally put a key in `.env` for local dev (see `.env.example`). Note: a `VITE_` var ships to the
browser bundle — fine for a demo build; production should proxy Gemini behind a backend.

## Deploy (static)

```bash
npm run build      # typecheck + production bundle in dist/
```

### Replit (the hackathon host)
This repo is Replit-ready (`.replit` included):
1. Replit → **Create App → Import from GitHub** → paste the repo (open the `verdict/` folder as the workspace).
2. Hit **Run** — the Vite dev preview opens on the `*.replit.dev` URL (`vite.config.ts` already allows the Replit proxy host).
3. Set your key: **Tools → Secrets → `VITE_GEMINI_API_KEY`** (or skip it and paste a key in-app).
4. **Deploy → Static** — build `npm run build`, public dir `dist`. Ships to a `*.replit.app` URL.

### Other static hosts

- **Vercel**: `npx vercel deploy dist --prod` (or drag `dist/` into vercel.com/new)
- **Netlify**: drag `dist/` into app.netlify.com/drop
- **GitHub Pages**: push, enable Pages on the `dist` output via an action

No server, no env needed for the sample path; live mode keys are user-supplied at runtime.

## Architecture

```
src/
  types.ts    — Finding / Valuation / Negotiation / VerdictResult
  data.ts     — comps dataset, valuation + negotiation math (deterministic, in code)
  engine.ts   — orchestrator: demo path (staged mock) / live path (lazy-loads gemini.ts)
  gemini.ts   — live pipeline: multimodal perception → JSON findings → verify pass
  image.ts    — client-side downscale (1280px) before upload
  App.tsx     — intake (upload + asking price), staged analyzing, report UI
```

Design decision worth stealing: **the model perceives, the code prices.** Gemini only ever outputs
structured observations about what is visible; every dollar figure is deterministic arithmetic over the
comps dataset with per-finding attribution. That is what makes the output defensible.

## Disclaimer

Verdict is decision support, not a substitute for a professional pre-purchase inspection. Always verify
title, VIN history, and safety-critical items independently before buying.
