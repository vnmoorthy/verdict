import { GoogleGenAI } from '@google/genai'
import type { RunOpts } from './engine'
import type { Finding, Severity, VerdictResult, ScamRisk, ScamSignal, ScamAssessment } from './types'
import { assembleItemResult, priceAnomalySignal, maxRisk } from './data'

// Verified live against this key on 2026-07-19: gemini-3.5-flash returns 200
// with vision input + responseMimeType json. (2.5-flash is 404 for new keys.)
const MODEL = 'gemini-3.5-flash'

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const RISKS: ScamRisk[] = ['low', 'medium', 'high']

const INSPECT_PROMPT = `You are Verdict — a master appraiser and fraud investigator for used-goods marketplaces
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
- If the photos are not a sellable item, return category "other", empty findings, fairPrice all zero.`

const clamp01 = (n: number) => (isNaN(n) ? 0 : Math.max(0, Math.min(1, n)))
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }

function dataUrlToPart(dataUrl: string) {
  const [head, body] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(head)?.[1] || 'image/jpeg'
  return { inlineData: { mimeType: mime, data: body } }
}

function normalizeFinding(raw: any, i: number): Finding {
  const sev: Severity = SEVERITIES.includes(raw?.severity) ? raw.severity : 'medium'
  const r = raw?.region || {}
  return {
    id: `f${i + 1}`,
    title: String(raw?.title ?? 'Unnamed finding'),
    area: String(raw?.area ?? 'Condition'),
    severity: sev,
    confidence: clamp01(num(raw?.confidence ?? 0.6)),
    priceImpact: Math.min(0, Math.round(num(raw?.priceImpact ?? 0))),
    rationale: String(raw?.rationale ?? 'No rationale provided.'),
    angle: String(raw?.angle ?? 'Photo'),
    region: {
      x: clamp01(num(r.x ?? 0.3)), y: clamp01(num(r.y ?? 0.3)),
      w: clamp01(num(r.w ?? 0.2)), h: clamp01(num(r.h ?? 0.2)),
    },
    imageIndex: Number.isInteger(raw?.imageIndex) ? Number(raw.imageIndex) : undefined,
    needsMoreAngles: !!raw?.needsMoreAngles,
    verified: false,
  }
}

function normalizeRisk(v: any): ScamRisk { return RISKS.includes(v) ? v : 'low' }
function normalizeSignal(raw: any): ScamSignal {
  return {
    label: String(raw?.label ?? 'Signal'),
    detail: String(raw?.detail ?? ''),
    severity: normalizeRisk(raw?.severity),
  }
}
function defaultScamSummary(risk: ScamRisk): string {
  if (risk === 'high') return 'High scam risk — meet in person, verify the item works, and never send money or a deposit in advance.'
  if (risk === 'medium') return 'Some risk signals — verify in person before paying and ask for live, in-hand photos.'
  return 'No strong scam signals, but always meet in a safe public place and inspect before paying.'
}

function extractText(resp: any): string {
  return resp?.text ?? resp?.response?.text?.() ?? resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function runVerdictLive(opts: RunOpts): Promise<VerdictResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey! })

  // 1) Perception — multimodal, structured output
  opts.onStage?.('perception')
  const parts: any[] = (opts.images ?? []).map(dataUrlToPart)
  const askText = `Asking price: $${opts.askingPrice ?? 'unknown'}.`
  const descText = opts.description ? `\nListing description: """${opts.description.slice(0, 1200)}"""` : ''
  parts.push({ text: `${INSPECT_PROMPT}\n\n${askText}${descText}` })

  let resp: any
  try {
    resp = await (ai as any).models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    })
  } catch (e: any) {
    const m = String(e?.message ?? e)
    if (/429|quota|rate|resource_exhausted/i.test(m)) throw new Error('Gemini is rate-limited right now. Wait a few seconds and try again.')
    if (/401|403|api[ _-]?key|permission|unauthenticated|invalid argument/i.test(m)) throw new Error('Your Gemini key was rejected. Check it in Settings → paste a valid key.')
    throw new Error('Couldn’t reach the inspection service. Check your connection and try again.')
  }
  let parsed: any
  try {
    parsed = JSON.parse(extractText(resp) || '{}')
  } catch {
    throw new Error('The inspection came back malformed. Try again, or use fewer, clearer photos.')
  }

  const category = String(parsed?.category ?? 'other')
  const title = String(parsed?.title ?? '').trim()
  const subtitle = parsed?.subtitle ? String(parsed.subtitle) : undefined
  let findings: Finding[] = (parsed?.findings ?? []).map(normalizeFinding)

  const fair = {
    low: num(parsed?.fairPrice?.low),
    high: num(parsed?.fairPrice?.high),
    typical: num(parsed?.fairPrice?.typical),
    reasoning: String(parsed?.fairPrice?.reasoning ?? ''),
  }

  // Guard: photos that don't read as a sellable item must never produce a report.
  const readable = (title.length > 1 && category !== 'other') || findings.length > 0
  if (!readable) {
    throw new Error(
      'Couldn’t read these photos as a sellable item. Try clearer, in-hand photos of one item.',
    )
  }

  // 2) Verify — adversarial second pass over material findings
  opts.onStage?.('verify')
  findings = await verifyFindings(ai, findings)

  // 3) Scam assessment: model authenticity signals + deterministic price-anomaly signal
  const auth = parsed?.authenticity ?? {}
  const signals: ScamSignal[] = Array.isArray(auth?.signals) ? auth.signals.map(normalizeSignal) : []
  const anomaly = priceAnomalySignal(num(opts.askingPrice), fair.low)
  if (anomaly) signals.unshift(anomaly)
  let risk: ScamRisk = normalizeRisk(auth?.risk)
  for (const s of signals) risk = maxRisk(risk, s.severity)
  const scam: ScamAssessment | undefined = signals.length
    ? { risk, signals, summary: String(auth?.summary || defaultScamSummary(risk)) }
    : undefined

  // 4) Valuation + negotiation assembled deterministically in code
  opts.onStage?.('valuation')
  opts.onStage?.('negotiate')
  const usableFair =
    fair.typical > 0
      ? fair
      : { low: 0, high: 0, typical: Math.max(1, num(opts.askingPrice)), reasoning: 'Not enough visible detail to estimate a market price with confidence.' }

  const result = assembleItemResult({
    category,
    title: title || 'Used item',
    subtitle,
    askingPrice: num(opts.askingPrice),
    findings,
    fair: usableFair,
    scam,
    images: opts.images,
  })
  opts.onStage?.('done')
  return result
}

async function verifyFindings(ai: any, findings: Finding[]): Promise<Finding[]> {
  const material = findings.filter((f) => f.priceImpact < 0 || f.severity === 'high' || f.severity === 'critical')
  if (!material.length) return findings.map((f) => ({ ...f, verified: true }))
  const prompt =
    `A junior inspector proposed these findings about a used item. For each, answer strictly whether the stated ` +
    `evidence supports it. Return JSON: {"verdicts":[{"id":string,"supported":boolean,"confidence":number}]}\n\n` +
    JSON.stringify(material.map((f) => ({ id: f.id, title: f.title, rationale: f.rationale, evidence: f.angle })))
  try {
    const resp: any = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    })
    const v = JSON.parse(extractText(resp) || '{}')
    const map = new Map<string, any>((v?.verdicts ?? []).map((x: any) => [x.id, x]))
    return findings
      .map((f) => {
        const vv = map.get(f.id)
        if (!vv) return { ...f, verified: true }
        return { ...f, verified: !!vv.supported, confidence: clamp01(num(vv.confidence ?? f.confidence)) }
      })
      .filter((f) => f.verified !== false)
  } catch {
    return findings.map((f) => ({ ...f, verified: true }))
  }
}
