import type { Stage, VerdictResult, Vehicle } from './types'
import { buildMockResult, buildMockItemResult } from './data'

export interface RunOpts {
  mode: 'demo' | 'live'
  apiKey?: string
  images?: string[] // data URLs
  vehicleHint?: Partial<Vehicle>
  askingPrice?: number
  description?: string
  sample?: 'car' | 'item'
  onStage?: (s: Stage) => void
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runVerdict(opts: RunOpts): Promise<VerdictResult> {
  if (opts.mode === 'live' && opts.apiKey && opts.images && opts.images.length) {
    const { runVerdictLive } = await import('./gemini')
    return runVerdictLive(opts)
  }
  return runVerdictDemo(opts)
}

async function runVerdictDemo(opts: RunOpts): Promise<VerdictResult> {
  const stages: Stage[] = ['perception', 'valuation', 'verify', 'negotiate']
  for (const s of stages) {
    opts.onStage?.(s)
    await delay(720 + Math.random() * 520)
  }
  opts.onStage?.('done')
  return opts.sample === 'item' ? buildMockItemResult() : buildMockResult()
}
