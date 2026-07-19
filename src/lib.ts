import type { Mode } from './types'

export const usd = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US')

export const pct = (n: number) => Math.round(n * 100) + '%'

export const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const KEY_STORE = 'verdict.geminiKey'
const MODE_STORE = 'verdict.mode'

export function getKey(): string {
  try {
    return (
      localStorage.getItem(KEY_STORE) ||
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      ''
    )
  } catch {
    return ''
  }
}
export function setKey(k: string) {
  try { localStorage.setItem(KEY_STORE, k.trim()) } catch {}
}
export function getMode(): Mode {
  try { return localStorage.getItem(MODE_STORE) === 'live' ? 'live' : 'demo' } catch { return 'demo' }
}
export function setMode(m: Mode) {
  try { localStorage.setItem(MODE_STORE, m) } catch {}
}

export const severityColor: Record<string, string> = {
  critical: 'var(--crit)',
  high: 'var(--high)',
  medium: 'var(--warn)',
  low: 'var(--ink-faint)',
}
