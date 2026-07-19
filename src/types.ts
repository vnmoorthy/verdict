export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type VerdictKind = 'overpriced' | 'fair' | 'deal'
export type Mode = 'demo' | 'live'
export type Stage = 'perception' | 'valuation' | 'verify' | 'negotiate' | 'done'

export interface Region { x: number; y: number; w: number; h: number } // 0..1 fractions of the frame

export interface Finding {
  id: string
  title: string
  area: string
  severity: Severity
  confidence: number // 0..1
  rationale: string
  priceImpact: number // dollars, <= 0
  angle: string
  region: Region
  imageIndex?: number
  needsMoreAngles?: boolean
  verified?: boolean
}

export interface Comp {
  id: string
  title: string
  price: number
  mileage: number
  distanceMi: number
  note: string
}

export interface Adjustment { findingId: string; label: string; amount: number }

export interface Valuation {
  baseValue: number
  adjustments: Adjustment[]
  fairValue: number
  low: number
  high: number
  comps: Comp[]
}

export interface Negotiation {
  targetPrice: number
  openingOffer: number
  script: string
  leverage: string[]
}

export interface Vehicle {
  year: number
  make: string
  model: string
  trim: string
  mileage: number
  askingPrice: number
  location?: string
}

export interface VerdictResult {
  vehicle: Vehicle
  findings: Finding[]
  valuation: Valuation
  negotiation: Negotiation
  overallConfidence: number
  kind: VerdictKind
  summary: string
  images?: string[]
  // Generalized (any Marketplace item) fields:
  category?: string
  title?: string
  subtitle?: string
  scam?: ScamAssessment
  priceMethod?: 'comps' | 'model'
  priceReasoning?: string
}

export interface EvalRow { id: string; label: string; predicted: string; actual: string; correct: boolean }
export interface EvalSummary { n: number; precision: number; recall: number; note: string; rows: EvalRow[] }

export type ScamRisk = 'low' | 'medium' | 'high'
export interface ScamSignal { label: string; detail: string; severity: ScamRisk }
export interface ScamAssessment { risk: ScamRisk; signals: ScamSignal[]; summary: string }
