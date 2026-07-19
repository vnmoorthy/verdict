# Verdict × Google AI Studio

**Stanford × Google DeepMind "Build with Google Gemini" Hackathon — July 2026**

Verdict is a used-Marketplace listing inspector. You give it photos of one item (plus its
asking price and optional listing text) and it returns a structured appraisal: what the item is,
condition findings anchored to the actual photos, a scam / authenticity read, and a realistic
used-resale price range.

This document is an **honest** account of exactly how Google AI Studio and the Gemini API are
used in Verdict — written so a hackathon judge can paste our prompts into AI Studio and
reproduce our results.

---

## What was actually built in AI Studio (and what wasn't)

To be precise about our attribution:

- **The Gemini prompts were prototyped and tuned in Google AI Studio.** We iterated on the
  perception prompt (the strict-JSON appraisal prompt) and the adversarial verify prompt in
  AI Studio's prompt playground — uploading sample listing photos, tightening the JSON schema in
  the prompt, and dialing temperature — before copying the final prompt text into the app.
- **The app calls the Google Gemini API at runtime.** Verdict is a React + TypeScript (Vite) app
  that calls Gemini through the official `@google/genai` SDK (`^2.12.0`). The exact prompts that
  ship in the app are the ones we tuned in AI Studio; see `src/gemini.ts`.
- **We did NOT author the whole application inside AI Studio's code editor.** The app code
  (React UI, image handling, deterministic pricing/negotiation logic) was written in a normal
  repo. AI Studio's role was prompt engineering + being the source of our API key. We're
  calling that out explicitly so nothing here is overclaimed.

**One-line attribution (safe to use in the UI / README):**

> Prompts prototyped and tuned in Google AI Studio; Verdict calls the Google Gemini API
> (`gemini-3.5-flash`) for multimodal perception and an adversarial verify pass.

---

## Model + configuration

| Setting | Value | Where |
| --- | --- | --- |
| Model | `gemini-3.5-flash` | `MODEL` in `src/gemini.ts` |
| SDK | `@google/genai` `^2.12.0` (`GoogleGenAI`, `ai.models.generateContent`) | `package.json` |
| Response format | `responseMimeType: "application/json"` (strict JSON) | perception + verify calls |
| Temperature (perception) | `0.2` | perception call |
| Temperature (verify) | `0` | verify call |
| Inputs | **Multimodal** — base64 image parts (`inlineData`) + a text part | perception call |

> Note (verified in-repo on 2026-07-19): we use `gemini-3.5-flash`. For newly created API keys,
> `gemini-2.5-flash` returned 404, while `gemini-3.5-flash` returns 200 with vision input +
> `responseMimeType: application/json`.

Deterministic-by-design: **pricing and negotiation math are plain TypeScript, not the model.**
The model perceives and flags; the code (`src/data.ts` — `assembleItemResult`,
`priceAnomalySignal`, `maxRisk`) computes the fair-value adjustments, the price-anomaly scam
signal, and the negotiation numbers. Gemini is used for perception + verification only.

The API request the app sends (abridged from `src/gemini.ts`):

```ts
const ai = new GoogleGenAI({ apiKey })

// 1) Perception — multimodal, strict JSON
await ai.models.generateContent({
  model: 'gemini-3.5-flash',
  contents: [{ role: 'user', parts: [
    ...images.map(dataUrlToPart),                       // inlineData: { mimeType, data(base64) }
    { text: `${INSPECT_PROMPT}\n\n${askText}${descText}` }, // prompt + "Asking price: $X." + optional listing text
  ] }],
  config: { responseMimeType: 'application/json', temperature: 0.2 },
})

// 2) Verify — adversarial second pass, text only
await ai.models.generateContent({
  model: 'gemini-3.5-flash',
  contents: [{ role: 'user', parts: [{ text: VERIFY_PROMPT }] }],
  config: { responseMimeType: 'application/json', temperature: 0 },
})
```

---

## Reproduce it in AI Studio

Open [aistudio.google.com](https://aistudio.google.com), start a new chat/prompt, and in the
**Run settings** panel on the right:

1. Set **Model** to `gemini-3.5-flash`.
2. Set **Temperature** to `0.2` (for the verify prompt below, use `0`).
3. Turn on **Structured output / JSON mode** (this is the `responseMimeType: application/json`
   setting). Our schema is expressed inline in the prompt text, so JSON mode alone reproduces it.
4. Attach 1–5 photos of a single used item using the image/attachment button.
5. Paste the perception prompt below, then append the asking-price/description line the app adds.

### Prompt 1 — Perception (used-goods appraisal → strict JSON)

This is the verbatim system prompt from `src/gemini.ts` (`INSPECT_PROMPT`). Paste it, attach your
photos, then add the final line the app appends at runtime:
`Asking price: $<price>.` and, if you have listing text, a second line
`Listing description: """<text>"""`.

```
You are Verdict — a master appraiser and fraud investigator for used-goods marketplaces
(Facebook Marketplace, Craigslist, OfferUp). You are given photos of ONE used item a buyer is considering,
plus its asking price and an optional listing description. Inspect it like a pro: identify it, assess
condition, estimate a realistic used resale price, and flag scam / authenticity risk.

Return STRICT JSON:
{
  "category": "car|phone|laptop|tablet|furniture|sneakers|apparel|bike|appliance|tools|instrument|jewelry|handbag|electronics|other",
  "title": "concise item name — brand + model + key spec (e.g. 'Apple iPhone 15 Pro, 256GB')",
  "subtitle": "one-line condition summary + notable details",
  "findings": [{
    "title": string,                      // short defect / issue name
    "area": string,                       // Condition | Authenticity | Wear | Damage | Missing parts | Verification | Cosmetic
    "severity": "critical"|"high"|"medium"|"low",
    "confidence": number,                 // 0..1, calibrated — be honest
    "priceImpact": number,                // dollars to subtract from fair value (<= 0; 0 if no price effect)
    "angle": string,                      // which photo this was seen in
    "imageIndex": number,                 // 0-based index of the photo
    "region": { "x": number, "y": number, "w": number, "h": number }, // 0..1 box in that photo
    "rationale": string,                  // the visible evidence, 1-2 sentences
    "needsMoreAngles": boolean
  }],
  "authenticity": {
    "risk": "low"|"medium"|"high",
    "signals": [{ "label": string, "detail": string, "severity": "low"|"medium"|"high" }],
    "summary": string                     // one-line takeaway for the buyer
  },
  "fairPrice": { "low": number, "high": number, "typical": number, "reasoning": string }
}

Rules:
- Anchor every finding to visible evidence. Never invent damage or specs you cannot see.
- Scam / authenticity signals to weigh: photos that look like manufacturer/press/stock images rather than the
  real in-hand item; watermarks or screenshots; too few or mismatched photos; no photo of the powered-on
  device / serial / IMEI; counterfeit tells (fonts, logos, stitching, hardware); listing-text red flags
  (pushes deposits, shipping-only, off-platform payment, urgency). If none, risk="low", signals=[].
- fairPrice is a realistic USED resale range for THIS item in THIS condition. Base it on retail price and
  normal depreciation. If uncertain, widen the range rather than guessing narrow.
- If the photos are not a sellable item, return category "other", empty findings, fairPrice all zero.
```

Then append (the app builds these two lines from the user's inputs):

```
Asking price: $850.
Listing description: """Barely used, moving sale, cash only, can ship if you send deposit first."""
```

### Prompt 2 — Verify (adversarial second pass → strict JSON)

After the appraisal, the app runs a cheap adversarial check over the **material** findings only
(those with a negative price impact or `high`/`critical` severity). Set **Temperature = 0**, keep
JSON mode on, and paste this — replacing the array with the findings you want to challenge:

```
A junior inspector proposed these findings about a used item. For each, answer strictly whether the stated evidence supports it. Return JSON: {"verdicts":[{"id":string,"supported":boolean,"confidence":number}]}

[{"id":"f1","title":"Cracked rear glass","rationale":"Hairline crack across the lower-right corner of the back panel visible under glare.","evidence":"Back photo"}]
```

The app keeps only findings the verifier supports (`supported: true`) and re-uses the verifier's
confidence — so anything the second pass can't stand behind is dropped before it reaches the buyer.

---

## Get a Gemini API key from AI Studio

1. Go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
2. Sign in with a Google account and accept the terms.
3. Click **Create API key**. The key appears immediately and starts with `AIza…`.
4. Use it in Verdict one of two ways:
   - **Paste at runtime** — the app has a Settings field; the key is stored in your browser only.
   - **Local dev / Replit** — set `VITE_GEMINI_API_KEY` (see `.env.example`, or Replit → Secrets).

> Security note: `VITE_`-prefixed vars are bundled into the browser build — fine for a personal /
> demo build, but for production you'd proxy Gemini through a backend so the key never ships to the
> client. This is called out in `.env.example` too.

---

## Files that matter

- `src/gemini.ts` — the live Gemini integration: both prompts, model, config, JSON parsing +
  normalization, and the verify pass. **This is the source of truth for the prompts above.**
- `src/data.ts` — the deterministic pricing / negotiation / price-anomaly logic (no model calls).
- `src/engine.ts` — routes between the demo path and the live Gemini path.
- `.env.example` — API-key setup for local dev.

### Sources (AI Studio conventions, verified July 2026)

- [Using Gemini API keys — Google AI for Developers](https://ai.google.dev/gemini-api/docs/api-key)
- [Structured outputs — Gemini API](https://ai.google.dev/gemini-api/docs/structured-output)
- [Get API Key from Google AI Studio](https://aistudio.google.com/apikey)
