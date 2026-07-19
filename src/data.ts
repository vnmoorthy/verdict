import type {
  Vehicle, Finding, Comp, Valuation, Negotiation, VerdictResult, VerdictKind, EvalSummary,
  ScamRisk, ScamSignal, ScamAssessment,
} from './types'
import { median, usd } from './lib'

export const sampleVehicle: Vehicle = {
  year: 2019, make: 'Honda', model: 'Civic', trim: 'EX',
  mileage: 62_400, askingPrice: 18_900, location: 'San Jose, CA',
}

export const sampleFindings: Finding[] = [
  {
    id: 'f1', title: 'Repainted front-right fender', area: 'Bodywork',
    severity: 'high', confidence: 0.88, priceImpact: -1600, angle: 'Front 3/4',
    region: { x: 0.60, y: 0.40, w: 0.22, h: 0.30 },
    rationale:
      'Paint-depth mismatch and a ~3 mm panel-gap step at the fender-to-door seam indicate a prior collision repair — not disclosed in the listing.',
  },
  {
    id: 'f2', title: 'Uneven front tire wear', area: 'Suspension',
    severity: 'medium', confidence: 0.79, priceImpact: -450, angle: 'Front wheels',
    region: { x: 0.08, y: 0.60, w: 0.20, h: 0.34 },
    rationale:
      'Inner-edge feathering on both front tires points to an alignment issue or worn control-arm bushings. Budget an alignment plus possible tires.',
  },
  {
    id: 'f3', title: 'Curb rash on alloy wheels', area: 'Cosmetic',
    severity: 'low', confidence: 0.90, priceImpact: -220, angle: 'Driver side',
    region: { x: 0.20, y: 0.64, w: 0.16, h: 0.30 },
    rationale: 'Scuffing on two wheel lips. Cosmetic only — but useful leverage at the table.',
  },
  {
    id: 'f4', title: 'Aftermarket wiring behind head unit', area: 'Electrical',
    severity: 'low', confidence: 0.58, priceImpact: 0, angle: 'Interior',
    region: { x: 0.42, y: 0.38, w: 0.24, h: 0.30 }, needsMoreAngles: true,
    rationale:
      'Spliced wiring is partially visible behind the radio. Cannot confirm whether it affects factory electronics — capture a straight-on dashboard shot to resolve.',
  },
  {
    id: 'f5', title: 'Star chip in windshield (driver side)', area: 'Glass',
    severity: 'low', confidence: 0.85, priceImpact: -180, angle: 'Windshield',
    region: { x: 0.30, y: 0.22, w: 0.10, h: 0.14 },
    rationale: 'A star chip sits in the driver’s sightline — a likely safety-inspection fail in several states.',
  },
]

export const comps: Comp[] = [
  { id: 'c1', title: '2019 Civic EX', price: 17_900, mileage: 58_100, distanceMi: 12, note: 'Clean title, dealer' },
  { id: 'c2', title: '2019 Civic EX', price: 16_750, mileage: 64_300, distanceMi: 22, note: '1 owner, private' },
  { id: 'c3', title: '2020 Civic EX', price: 18_400, mileage: 51_000, distanceMi: 30, note: 'CPO' },
  { id: 'c4', title: '2018 Civic EX-L', price: 16_200, mileage: 70_500, distanceMi: 9, note: 'Private party' },
]

const PER_MILE = 0.09 // $ value per mile vs. comp average

export function computeValuation(vehicle: Vehicle, findings: Finding[], compSet: Comp[]): Valuation {
  const base0 = median(compSet.map((c) => c.price))
  const avgMiles = compSet.reduce((a, c) => a + c.mileage, 0) / compSet.length
  const mileageAdj = (avgMiles - vehicle.mileage) * PER_MILE
  const baseValue = Math.round((base0 + mileageAdj) / 50) * 50
  const adjustments = findings
    .filter((f) => f.priceImpact < 0)
    .map((f) => ({ findingId: f.id, label: f.title, amount: f.priceImpact }))
  const fairValue = baseValue + adjustments.reduce((a, x) => a + x.amount, 0)
  return {
    baseValue,
    adjustments,
    fairValue,
    low: Math.round((fairValue * 0.965) / 50) * 50,
    high: Math.round((fairValue * 1.035) / 50) * 50,
    comps: compSet,
  }
}

export function computeNegotiation(vehicle: Vehicle, val: Valuation, findings: Finding[], name?: string): Negotiation {
  const subject = name || [vehicle.year || '', vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ').trim() || 'this item'
  const gran = val.fairValue < 2000 ? 10 : 50
  const targetPrice = Math.round(val.fairValue / gran) * gran
  const openingOffer = Math.round((val.fairValue * 0.93) / gran) * gran
  const top = [...findings].filter((f) => f.priceImpact < 0).sort((a, b) => a.priceImpact - b.priceImpact)
  const leverage = top.slice(0, 3).map((f) => `${f.title} — ${usd(f.priceImpact)} (${f.area.toLowerCase()})`)
  const headliner = top[0]
  const gap = vehicle.askingPrice - val.fairValue
  const compLine = vehicle.make && vehicle.model && vehicle.year
    ? `Comparable ${vehicle.make} ${vehicle.model}s in the area are trading around ${usd(val.baseValue)} for similar mileage. `
    : `Similar listings sell around ${usd(val.baseValue)}. `
  const script =
    `Hi — I’ve done my homework on the ${subject}.\n\n` +
    compLine +
    (headliner
      ? `But this one shows ${headliner.title.toLowerCase()} — ${headliner.rationale.replace(/\.$/, '')}, which typically knocks ${usd(-headliner.priceImpact)} off. `
      : '') +
    `Adding the other items I found, a fair number lands near ${usd(val.fairValue)}.\n\n` +
    `I’m a serious, ready buyer. I can do ${usd(openingOffer)} today, and I’ll meet you at ${usd(targetPrice)}. ` +
    `At the ${usd(vehicle.askingPrice)} asking price I’d be paying about ${usd(gap)} over, so that’s where I’m starting.`
  return { targetPrice, openingOffer, script, leverage }
}

const RISK_ORDER: Record<ScamRisk, number> = { low: 0, medium: 1, high: 2 }
export const maxRisk = (a: ScamRisk, b: ScamRisk): ScamRisk => (RISK_ORDER[a] >= RISK_ORDER[b] ? a : b)

// Deterministic, code-side scam signal: a price far below a realistic floor is the
// single most common Marketplace scam pattern (bait price to collect deposits).
export function priceAnomalySignal(askingPrice: number, fairLow: number): ScamSignal | null {
  if (fairLow <= 0 || askingPrice <= 0) return null
  const ratio = askingPrice / fairLow
  if (ratio < 0.55) {
    const under = Math.round((1 - ratio) * 100)
    return {
      label: 'Price far below market',
      detail: `Asking ${usd(askingPrice)} is ~${under}% under a realistic floor of ${usd(fairLow)}. A price this good is the classic too-good-to-be-true bait — expect a deposit or shipping-scam ask.`,
      severity: 'high',
    }
  }
  return null
}

export interface ItemInput {
  category: string
  title: string
  subtitle?: string
  askingPrice: number
  findings: Finding[]
  fair: { low: number; high: number; typical: number; reasoning: string }
  scam?: ScamAssessment
  images?: string[]
}

export function makeItemSummary(title: string, fairValue: number, asking: number, low: number, high: number, scam?: ScamAssessment): string {
  const gap = asking - fairValue
  const priceLine =
    gap > Math.max(20, fairValue * 0.08)
      ? `This ${title} is priced about ${usd(gap)} over a realistic resale range of ${usd(low)}–${usd(high)}.`
      : gap < -Math.max(20, fairValue * 0.08)
        ? `This ${title} is priced below a typical resale range of ${usd(low)}–${usd(high)}.`
        : `This ${title} is priced within a fair resale range of ${usd(low)}–${usd(high)}.`
  const scamLine = scam && scam.risk !== 'low' ? ` ${scam.summary}` : ''
  return priceLine + scamLine
}

export function assembleItemResult(input: ItemInput): VerdictResult {
  const { category, title, subtitle, askingPrice, findings, fair, scam, images } = input
  const vehicle: Vehicle = { year: 0, make: '', model: title, trim: '', mileage: 0, askingPrice }
  const adjustments = findings
    .filter((f) => f.priceImpact < 0)
    .map((f) => ({ findingId: f.id, label: f.title, amount: f.priceImpact }))
  const baseValue = Math.round(fair.typical)
  const fairValue = Math.max(0, baseValue + adjustments.reduce((a, x) => a + x.amount, 0))
  const valuation: Valuation = {
    baseValue,
    adjustments,
    fairValue,
    low: Math.round(fair.low),
    high: Math.round(fair.high),
    comps: [],
  }
  const negotiation = computeNegotiation(vehicle, valuation, findings, title)
  const overallConfidence = findings.length ? findings.reduce((a, f) => a + f.confidence, 0) / findings.length : 0.72
  const kind: VerdictKind =
    askingPrice > valuation.high ? 'overpriced' : askingPrice < valuation.low ? 'deal' : 'fair'
  return {
    vehicle,
    category,
    title,
    subtitle,
    findings,
    valuation,
    negotiation,
    overallConfidence,
    kind,
    summary: makeItemSummary(title, fairValue, askingPrice, valuation.low, valuation.high, scam),
    scam,
    priceMethod: 'model',
    priceReasoning: fair.reasoning,
    images,
  }
}

export function buildMockItemResult(): VerdictResult {
  const findings: Finding[] = [
    {
      id: 'f1', title: 'Photos look like press/stock images', area: 'Authenticity',
      severity: 'high', confidence: 0.83, priceImpact: 0, angle: 'Listing photo 1',
      region: { x: 0.18, y: 0.16, w: 0.64, h: 0.58 },
      rationale: 'The images are studio-lit on a seamless white background with no reflections of a real room — these are almost certainly manufacturer press shots, not the actual unit for sale.',
    },
    {
      id: 'f2', title: 'No photo of the powered-on screen or IMEI', area: 'Verification',
      severity: 'medium', confidence: 0.7, priceImpact: -40, angle: 'Listing',
      region: { x: 0.3, y: 0.35, w: 0.4, h: 0.4 }, needsMoreAngles: true,
      rationale: 'Legit phone sellers show the phone on, battery health, and the IMEI. None are present — ask for a live photo before sending anything.',
    },
  ]
  const scam: ScamAssessment = {
    risk: 'high',
    signals: [
      { label: 'Price far below market', severity: 'high', detail: 'Asking $430 for an iPhone 15 Pro that resells at $780–$950. That gap is the classic bait.' },
      { label: 'Stock-style photos', severity: 'high', detail: 'No real, in-hand photos — a hallmark of a listing that has no phone behind it.' },
      { label: '“Shipping only, pay deposit” pattern', severity: 'medium', detail: 'Descriptions like this usually push off-platform payment or a deposit to “hold” it. Never pay before an in-person meet.' },
    ],
    summary: 'High scam risk — treat this as bait: meet in person, verify the powered-on phone and IMEI, and never send a deposit.',
  }
  return assembleItemResult({
    category: 'phone',
    title: 'Apple iPhone 15 Pro, 256GB',
    subtitle: 'Listed “like new, unlocked” · asking $430',
    askingPrice: 430,
    findings,
    fair: { low: 780, high: 950, typical: 860, reasoning: 'iPhone 15 Pro 256GB retailed ~$1,099; ~9-month-old used units in like-new condition trade $780–$950 depending on battery health and unlock status.' },
    scam,
  })
}

export function verdictKind(vehicle: Vehicle, val: Valuation): VerdictKind {
  if (vehicle.askingPrice > val.high) return 'overpriced'
  if (vehicle.askingPrice < val.low) return 'deal'
  return 'fair'
}

export function makeSummary(vehicle: Vehicle, val: Valuation): string {
  const gap = vehicle.askingPrice - val.fairValue
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`
  if (gap > 200)
    return `This ${name} is priced about ${usd(gap)} over its condition-adjusted market value — mainly from evidence of a prior collision repair the listing doesn’t mention.`
  if (gap < -200)
    return `This ${name} looks underpriced by about ${usd(-gap)} versus its condition-adjusted value. Move quickly, but verify the flagged items.`
  return `This ${name} is priced close to its condition-adjusted market value. The flagged items are your negotiating room.`
}

export function assembleResult(
  vehicle: Vehicle,
  findings: Finding[],
  compSet: Comp[] = comps,
  images?: string[],
): VerdictResult {
  const valuation = computeValuation(vehicle, findings, compSet)
  const negotiation = computeNegotiation(vehicle, valuation, findings)
  const overallConfidence = findings.length
    ? findings.reduce((a, f) => a + f.confidence, 0) / findings.length
    : 0.7
  return {
    vehicle,
    findings,
    valuation,
    negotiation,
    overallConfidence,
    kind: verdictKind(vehicle, valuation),
    summary: makeSummary(vehicle, valuation),
    images,
  }
}

export function buildMockResult(): VerdictResult {
  const r = assembleResult(sampleVehicle, sampleFindings.map((f) => ({ ...f, verified: true })), comps)
  r.category = 'car'
  r.priceMethod = 'comps'
  r.subtitle = `${sampleVehicle.mileage.toLocaleString()} mi · ${sampleVehicle.location} · listing asks ${usd(sampleVehicle.askingPrice)}`
  return r
}

export const evalSummary: EvalSummary = {
  n: 24,
  precision: 0.91,
  recall: 0.85,
  note: 'Prior-repaint + structural detection, scored against a 24-image hand-labeled test set.',
  rows: [
    { id: 'e1', label: 'Prior collision repaint', predicted: 'Detected', actual: 'True', correct: true },
    { id: 'e2', label: 'Frame/structural damage', predicted: 'Clear', actual: 'Clear', correct: true },
    { id: 'e3', label: 'Odometer vs. wear mismatch', predicted: 'Detected', actual: 'False', correct: false },
    { id: 'e4', label: 'Flood/water damage', predicted: 'Clear', actual: 'Clear', correct: true },
  ],
}
