import { useRef, useState } from 'react'
import type { Finding, Region, Stage, VerdictResult, ScamAssessment } from './types'
import { runVerdict } from './engine'
import { sampleVehicle, evalSummary } from './data'
import { usd, pct, getKey, setKey, getMode, setMode, severityColor } from './lib'
import { filesToImages } from './image'

const STAGES: { id: Stage; lbl: string; sub: string }[] = [
  { id: 'perception', lbl: 'Perceiving condition', sub: 'Fusing angles · grounding regions' },
  { id: 'valuation', lbl: 'Grounding valuation', sub: 'Retrieving comparable listings' },
  { id: 'verify', lbl: 'Verifying findings', sub: 'Adversarial second pass' },
  { id: 'negotiate', lbl: 'Building your position', sub: 'Target price · negotiation script' },
]
const ORDER: Stage[] = ['perception', 'valuation', 'verify', 'negotiate', 'done']
const ANGLES = ['Front 3/4', 'Rear 3/4', 'Driver side', 'Passenger side', 'Dashboard', 'Engine bay', 'Tires']

type Source = 'sample' | 'live'
type Screen = 'intake' | 'analyzing' | 'report' | 'error'

export default function App() {
  const [screen, setScreen] = useState<Screen>('intake')
  const [stage, setStage] = useState<Stage>('perception')
  const [result, setResult] = useState<VerdictResult | null>(null)
  const [source, setSource] = useState<Source>('sample')
  const [errMsg, setErrMsg] = useState('')
  const [mode, setModeState] = useState<'demo' | 'live'>(getMode())
  const [showSettings, setShowSettings] = useState(false)
  const reqRef = useRef(0)

  function goHome() {
    reqRef.current++ // cancel any in-flight inspection
    setScreen('intake')
  }

  async function inspectSample(sample: 'car' | 'item' = 'car') {
    const id = ++reqRef.current
    setResult(null)
    setStage('perception')
    setSource('sample')
    setScreen('analyzing')
    const r = await runVerdict({ mode: 'demo', sample, onStage: setStage })
    if (reqRef.current !== id) return
    setResult(r)
    setScreen('report')
  }

  async function inspectLive(images: string[], askingPrice: number, description?: string) {
    const id = ++reqRef.current
    setResult(null)
    setStage('perception')
    setSource('live')
    setScreen('analyzing')
    try {
      const r = await runVerdict({
        mode: 'live',
        apiKey: getKey(),
        images,
        askingPrice,
        description,
        onStage: setStage,
      })
      if (reqRef.current !== id) return
      setResult(r)
      setScreen('report')
    } catch (e: any) {
      if (reqRef.current !== id) return
      setErrMsg(String(e?.message ?? e ?? 'The live inspection failed.'))
      setScreen('error')
    }
  }

  return (
    <div className="app">
      <Topbar mode={mode} onSettings={() => setShowSettings(true)} onHome={goHome} />
      <main style={{ flex: 1 }}>
        <div className="container">
          {screen === 'intake' && (
            <Intake
              hasKey={!!getKey()}
              onSample={inspectSample}
              onLive={inspectLive}
              onNeedKey={() => setShowSettings(true)}
            />
          )}
          {screen === 'analyzing' && <Analyzing stage={stage} live={source === 'live'} />}
          {screen === 'report' && result && (
            <Report result={result} source={source} onAgain={goHome} />
          )}
          {screen === 'error' && (
            <ErrorScreen
              msg={errMsg}
              onSample={() => inspectSample('car')}
              onBack={goHome}
            />
          )}
        </div>
      </main>
      <Footer />
      <BottomNav onHome={goHome} onSettings={() => setShowSettings(true)} />
      {showSettings && (
        <SettingsModal
          mode={mode}
          onClose={() => setShowSettings(false)}
          onSave={(m) => {
            setMode(m)
            setModeState(m)
            setShowSettings(false)
          }}
        />
      )}
    </div>
  )
}

function Topbar({ mode, onSettings, onHome }: { mode: 'demo' | 'live'; onSettings: () => void; onHome: () => void }) {
  return (
    <div className="topbar">
      <div className="container">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={onHome}>
          <span className="mark">V</span>
          <span>Verdict</span>
        </div>
        <span className="spacer" />
        <span className={`badge ${mode === 'live' ? 'live' : ''}`}>
          <span className="dot" />
          {mode === 'live' ? 'Live · Gemini' : 'Demo mode'}
        </span>
        <button className="btn btn-ghost" onClick={onSettings}>Settings</button>
      </div>
    </div>
  )
}

function Intake({
  hasKey, onSample, onLive, onNeedKey,
}: {
  hasKey: boolean
  onSample: (sample: 'car' | 'item') => void
  onLive: (images: string[], askingPrice: number, description?: string) => void
  onNeedKey: () => void
}) {
  const [images, setImages] = useState<string[]>([])
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const priceNum = Number(price.replace(/[^0-9.]/g, ''))
  const priceOk = priceNum >= 1 && priceNum <= 500_000
  const canInspect = images.length > 0 && priceOk && hasKey

  async function addFiles(files: FileList | File[]) {
    setBusy(true)
    try {
      const next = await filesToImages(files, 8 - images.length)
      setImages((prev) => [...prev, ...next].slice(0, 8))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="hero">
      <div className="eyebrow">Marketplace inspector · from photos</div>
      <h1 style={{ marginTop: 14 }}>
        Don’t get played on <span className="accent">Marketplace.</span>
      </h1>
      <p className="lede">
        Upload any used listing — car, phone, couch, sneakers — with the asking price. Verdict inspects it like
        a pro: the <b>fair price</b>, what’s <b>wrong with it</b>, and whether it’s a <b>scam</b> — in 60
        seconds, before you drive out or send a cent.
      </p>

      <div className="cta-row">
        <button className="btn btn-primary btn-lg" onClick={() => onSample('car')}>
          Sample: used car →
        </button>
        <button className="btn btn-lg" onClick={() => onSample('item')}>
          Sample: Marketplace scam →
        </button>
      </div>

      <div className="or-div">or inspect a real listing</div>

      <div
        className={`uploader ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
      >
        <div className="uprow">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 8}>
            {busy ? 'Reading…' : '+ Add listing photos'}
          </button>
          <button className="btn btn-ghost" onClick={() => camRef.current?.click()} disabled={busy || images.length >= 8}>
            📷 Take photo
          </button>
          <span className="faint" style={{ fontSize: 13 }}>
            {images.length ? `${images.length}/8 photos` : 'Drag photos here · 1–8 · jpg/png/webp'}
          </span>
        </div>
        <input
          ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.currentTarget.value = '' }}
        />
        <input
          ref={camRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.currentTarget.value = '' }}
        />

        {images.length > 0 && (
          <div className="previews">
            {images.map((src, i) => (
              <div className="pv" key={i}>
                <img src={src} alt={`photo ${i + 1}`} />
                <button className="rm" aria-label="Remove photo"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}

        <textarea
          className="desc-input"
          rows={2}
          placeholder="Optional: paste the listing text — description, seller messages (sharpens scam detection)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        <div className="price-input">
          <span className="pfx">Asking price $</span>
          <input
            inputMode="numeric" placeholder="430" value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {price !== '' && !priceOk && (
            <span className="faint" style={{ fontSize: 12, color: 'var(--warn)' }}>
              Enter a price between $1 and $500,000
            </span>
          )}
          <span className="spacer" />
          {hasKey ? (
            <button className="btn btn-primary" disabled={!canInspect || busy}
              onClick={() => onLive(images, priceNum, desc.trim() || undefined)}>
              Inspect this listing →
            </button>
          ) : (
            <button className="btn" onClick={onNeedKey}>
              Add a Gemini key in Settings to inspect your own listing
            </button>
          )}
        </div>
        {images.length === 0 && (
          <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
            Add at least one photo to enable inspection. For cars, the angles below help most.
          </p>
        )}
        <div className="angles">
          {ANGLES.map((a) => <span className="angle-chip" key={a}><span className="tick">✓</span>{a}</span>)}
        </div>
      </div>
    </section>
  )
}

function Analyzing({ stage, live }: { stage: Stage; live: boolean }) {
  const cur = ORDER.indexOf(stage)
  return (
    <section className="analyzing">
      <div className="scanwrap">
        <div style={{ textAlign: 'center' }}>
          <div className="eyebrow">{live ? 'Inspecting your photos · Gemini' : 'Inspecting · sample'}</div>
          <h2 style={{ fontSize: 24, marginTop: 10 }}>Reading the car like a mechanic would</h2>
        </div>
        <div className="stagelist">
          {STAGES.map((s, i) => {
            const st = i < cur ? 'done' : i === cur ? 'active' : ''
            return (
              <div className={`stage ${st}`} key={s.id}>
                <div className="ic">{i < cur ? '✓' : i === cur ? <span className="spin">◍</span> : i + 1}</div>
                <div>
                  <div className="lbl">{s.lbl}</div>
                  <div className="sub">{s.sub}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ErrorScreen({ msg, onSample, onBack }: { msg: string; onSample: () => void; onBack: () => void }) {
  return (
    <section className="errscreen">
      <div className="eyebrow" style={{ color: 'var(--crit)' }}>Live inspection failed</div>
      <h2 style={{ fontSize: 24 }}>Couldn’t complete the inspection</h2>
      <p className="muted" style={{ maxWidth: '54ch' }}>{msg}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn" onClick={onBack}>← Try again</button>
        <button className="btn btn-primary" onClick={onSample}>View the sample report instead</button>
      </div>
      <p className="faint" style={{ fontSize: 12 }}>
        The sample is clearly labeled — your photos are never silently swapped for canned results.
      </p>
    </section>
  )
}

function Report({ result, source, onAgain }: { result: VerdictResult; source: Source; onAgain: () => void }) {
  const { vehicle: v, valuation: val, negotiation: neg, findings } = result
  const gap = v.askingPrice - val.fairValue
  const kindLabel = result.kind === 'overpriced' ? 'Overpriced' : result.kind === 'deal' ? 'Priced to move' : 'Fairly priced'
  const highScam = result.scam?.risk === 'high'
  const bannerKind = highScam ? 'overpriced' : result.kind

  return (
    <section className="report">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            Verdict
            {source === 'sample' && (
              <span className="badge" title="This is the built-in sample, not your photos">Sample report</span>
            )}
            {source === 'live' && <span className="badge live"><span className="dot" />Live · Gemini</span>}
            {result.category && <span className="cat-chip">{result.category}</span>}
          </div>
          <h2 style={{ fontSize: 24, marginTop: 6 }}>
            {(result.title || `${v.year || ''} ${v.make} ${v.model} ${v.trim}`).trim()}
          </h2>
          <div className="faint mono" style={{ fontSize: 13, marginTop: 2 }}>
            {result.subtitle
              ? result.subtitle
              : `${v.mileage ? v.mileage.toLocaleString() + ' mi · ' : ''}${v.location ? v.location + ' · ' : ''}listing asks ${usd(v.askingPrice)}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <ShareButton result={result} />
          <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={onAgain}>New →</button>
        </div>
      </div>

      {result.scam && result.scam.risk !== 'low' && <ScamPanel scam={result.scam} />}
      {(!result.scam || result.scam.risk === 'low') && (
        <div className="trust-card"><span className="tcheck">✓</span> No scam red flags detected in these photos.</div>
      )}

      <div className={`verdict-banner ${bannerKind}`}>
        <div>
          <span className={`verdict-tag ${bannerKind}`}>{highScam ? 'Too good to be true' : kindLabel}</span>
          <div className="verdict-headline">
            {highScam
              ? `This price is bait, not a bargain`
              : result.kind === 'overpriced'
                ? `You'd be overpaying about ${usd(gap)}`
                : result.kind === 'deal'
                  ? `Underpriced by about ${usd(-gap)}`
                  : `Priced within fair range`}
          </div>
          <p className="muted" style={{ maxWidth: '60ch', fontSize: 14.5 }}>{result.summary}</p>
        </div>
        <div className="pricegrid">
          <div className="pg"><div className="k">Asking</div><div className="v mono">{usd(v.askingPrice)}</div></div>
          <div className="pg"><div className="k">Fair value</div><div className="v fair mono">{usd(val.fairValue)}</div></div>
          <div className="pg"><div className="k">{highScam ? 'Below market' : gap >= 0 ? 'Overpay' : 'Upside'}</div><div className="v save mono">{usd(Math.abs(gap))}</div></div>
        </div>
      </div>

      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card block">
            <div className="head">
              <h3>What Verdict found</h3>
              <span className="sect-title">{findings.length} findings</span>
            </div>
            <div className="findings">
              {findings.length > 0 ? (
                findings.map((f) => <FindingRow key={f.id} f={f} images={result.images} />)
              ) : (
                <div className="cleanstate">
                  <span className="tcheck">✓</span>
                  No visible defects in the photos provided. Still meet in person and confirm it works before paying.
                </div>
              )}
            </div>
          </div>

          <div className="card block">
            <div className="head">
              <h3>How the price is built</h3>
              <span className="sect-title">
                {result.priceMethod === 'model' ? 'AI market estimate' : `grounded in ${val.comps.length} comps`}
              </span>
            </div>
            <Waterfall result={result} />
            {result.priceReasoning && (
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>{result.priceReasoning}</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card block">
            <div className="head">
              <h3>Your negotiation</h3>
              <span className="sect-title">get the fair price</span>
            </div>
            <div className="offerrow">
              <div className="offer"><div className="k">Open at</div><div className="v open mono">{usd(neg.openingOffer)}</div></div>
              <div className="offer"><div className="k">Target</div><div className="v mono">{usd(neg.targetPrice)}</div></div>
            </div>
            <ScriptBlock text={neg.script} />
            <div className="leverage">
              {neg.leverage.map((l, i) => <div className="lev" key={i}><span className="b">▸</span><span>{l}</span></div>)}
            </div>
          </div>

          <div className="card block">
            <div className="head">
              <h3>Confidence &amp; calibration</h3>
              <span className="sect-title">we measure it</span>
            </div>
            <div className="conf" style={{ fontSize: 14 }}>
              Overall confidence
              <span className="track" style={{ width: 120, height: 7 }}>
                <span className="fill" style={{ width: pct(result.overallConfidence) }} />
              </span>
              <span className="mono">{pct(result.overallConfidence)}</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: '10px 0 12px' }}>
              {result.category && result.category !== 'car'
                ? 'Findings are scored for calibration against a hand-labeled test set. Confidence is honest, not inflated — low-confidence items say so.'
                : evalSummary.note}
            </p>
            <div style={{ display: 'flex', gap: 22, marginBottom: 12 }}>
              <div><div className="k mono faint" style={{ fontSize: 11 }}>PRECISION</div><div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>{pct(evalSummary.precision)}</div></div>
              <div><div className="k mono faint" style={{ fontSize: 11 }}>RECALL</div><div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{pct(evalSummary.recall)}</div></div>
              <div><div className="k mono faint" style={{ fontSize: 11 }}>TEST SET</div><div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{evalSummary.n}</div></div>
            </div>
            <p className="faint" style={{ fontSize: 12 }}>
              Photo screens can’t see engine internals or frame damage underneath. For a serious candidate,
              still book a professional PPI — Verdict decides whether the drive is worth it.
            </p>
          </div>

          {val.comps.length > 0 && (
            <div className="card block">
              <div className="head"><h3>Comparable listings</h3></div>
              <table className="comptable">
                <thead><tr><th>Vehicle</th><th>Miles</th><th>Dist</th><th>Price</th></tr></thead>
                <tbody>
                  {val.comps.map((c) => (
                    <tr key={c.id}>
                      <td>{c.title}<div className="faint" style={{ fontSize: 11 }}>{c.note}</div></td>
                      <td className="mono">{(c.mileage / 1000).toFixed(0)}k</td>
                      <td className="mono">{c.distanceMi}mi</td>
                      <td className="mono">{usd(c.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ShareButton({ result }: { result: VerdictResult }) {
  const [done, setDone] = useState(false)
  const v = result.vehicle
  const name = (result.title || `${v.year || ''} ${v.make} ${v.model} ${v.trim}`).trim()
  const scamLine = result.scam && result.scam.risk !== 'low' ? ` ⚠ ${result.scam.risk} scam risk.` : ''
  const text = `${name} — Verdict: asking ${usd(v.askingPrice)}, fair ~${usd(result.valuation.fairValue)}.${scamLine} ${result.summary} (checked with Verdict)`
  function flag() { setDone(true); setTimeout(() => setDone(false), 1600) }
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: 'Verdict', text }); return }
    } catch { /* user cancelled — fall through to copy */ }
    try { await navigator.clipboard.writeText(text); flag(); return } catch { /* blocked — legacy fallback */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.focus(); ta.select()
      const ok = document.execCommand('copy'); document.body.removeChild(ta)
      if (ok) flag()
    } catch { /* give up silently */ }
  }
  return (
    <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={share}>
      {done ? '✓ Copied' : 'Share'}
    </button>
  )
}

function ScamPanel({ scam }: { scam: ScamAssessment }) {
  const label = scam.risk === 'high' ? 'High scam risk' : scam.risk === 'medium' ? 'Some scam risk' : 'Low scam risk'
  return (
    <div className={`scam-panel ${scam.risk}`}>
      <div className="scam-head">
        <span className="scam-badge">⚠ {label}</span>
        <p className="scam-sum">{scam.summary}</p>
      </div>
      <div className="scam-signals">
        {scam.signals.map((s, i) => (
          <div className="scam-sig" key={i}>
            <span className={`chip ${s.severity === 'high' ? 'critical' : s.severity === 'medium' ? 'medium' : 'low'}`}>{s.severity}</span>
            <div>
              <div className="scam-sig-label">{s.label}</div>
              <div className="scam-sig-detail">{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FindingRow({ f, images }: { f: Finding; images?: string[] }) {
  const color = severityColor[f.severity]
  const src = images && f.imageIndex != null ? images[f.imageIndex] : undefined
  return (
    <div className="finding">
      <div className="fthumb">
        {src ? (
          <>
            <img src={src} alt={f.angle} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span className="region" style={{
              left: `${f.region.x * 100}%`, top: `${f.region.y * 100}%`,
              width: `${f.region.w * 100}%`, height: `${f.region.h * 100}%`, borderColor: color,
            }} />
          </>
        ) : (
          <FrameThumb label={f.angle} region={f.region} color={color} />
        )}
      </div>
      <div>
        <div className="ftitle">
          {f.title}
          <span className={`chip ${f.severity}`}>{f.severity}</span>
          {f.verified && <span className="chip low" title="Confirmed by a second pass">✓ verified</span>}
        </div>
        <div className="frat">{f.rationale}</div>
        <div className="fmeta">
          <span className="conf">
            <span className="track"><span className="fill" style={{ width: pct(f.confidence) }} /></span>
            {pct(f.confidence)} conf
          </span>
          {f.needsMoreAngles && <span className="moreangle">⚠ needs another angle</span>}
        </div>
      </div>
      <div className={`fimpact ${f.priceImpact < 0 ? 'neg' : ''}`}>
        {f.priceImpact < 0 ? usd(f.priceImpact) : '—'}
      </div>
    </div>
  )
}

function Waterfall({ result }: { result: VerdictResult }) {
  const { valuation: val } = result
  const rows = [
    { label: 'Market base (comps)', amount: val.baseValue, kind: 'base' as const },
    ...val.adjustments.map((a) => ({ label: a.label, amount: a.amount, kind: 'adj' as const })),
    { label: 'Condition-adjusted fair value', amount: val.fairValue, kind: 'total' as const },
  ]
  return (
    <div className="waterfall">
      {rows.map((r, i) => {
        const w = Math.max(2, (Math.abs(r.amount) / val.baseValue) * 100)
        const barColor = r.kind === 'base' ? 'var(--ink-faint)' : r.kind === 'total' ? 'var(--teal)' : 'var(--high)'
        return (
          <div key={i}>
            <div className="wrow">
              <span className={`wlabel ${r.kind === 'base' ? 'base' : r.kind === 'total' ? 'total' : ''}`}>{r.label}</span>
              <span className={`wamt ${r.kind === 'adj' ? 'neg' : r.kind}`}>{usd(r.amount)}</span>
              <span className="wbar"><i style={{ width: `${w}%`, background: barColor }} /></span>
            </div>
          </div>
        )
      })}
      <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
        Fair range {usd(val.low)} – {usd(val.high)}. Every dollar of adjustment is tied to a finding above.
      </p>
    </div>
  )
}

function ScriptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="sect-title">Copy-paste script</span>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div className="script">{text}</div>
    </div>
  )
}

function FrameThumb({ region, color, label }: { region: Region; color: string; label: string }) {
  const hasRegion = region.w > 0 && region.h > 0
  const B = 9
  return (
    <svg viewBox="0 0 100 76" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect x="0" y="0" width="100" height="76" fill="var(--raise)" />
      <g stroke="var(--line)" strokeWidth="0.5" opacity="0.5">
        {[19, 38, 57].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} />)}
        {[25, 50, 75].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="76" />)}
      </g>
      <g stroke="var(--ink-faint)" strokeWidth="1.4" fill="none" opacity="0.7">
        <path d={`M4 ${4 + B} V4 H${4 + B}`} /><path d={`M${96 - B} 4 H96 V${4 + B}`} />
        <path d={`M4 ${72 - B} V72 H${4 + B}`} /><path d={`M${96 - B} 72 H96 V${72 - B}`} />
      </g>
      {hasRegion && (
        <>
          <rect x={region.x * 100} y={region.y * 76} width={region.w * 100} height={region.h * 76}
            fill="none" stroke={color} strokeWidth="2" rx="2" />
          <rect x={region.x * 100} y={region.y * 76 - 9} width={Math.max(18, region.w * 100)} height="8"
            fill={color} opacity="0.9" rx="1.5" />
        </>
      )}
      <text x="50" y={hasRegion ? 70 : 42} textAnchor="middle" fontSize="8" fill="var(--ink-faint)"
        fontFamily="var(--mono)">{label}</text>
    </svg>
  )
}

function SettingsModal({ mode, onClose, onSave }: { mode: 'demo' | 'live'; onClose: () => void; onSave: (m: 'demo' | 'live') => void }) {
  const [m, setM] = useState<'demo' | 'live'>(mode)
  const [key, setKeyLocal] = useState(getKey())
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18 }}>Settings</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          The sample reports need nothing. To inspect your own listing, add a Gemini API key — it runs real
          multimodal inspection on your photos.
        </p>
        <div className="field">
          <label>Default mode badge</label>
          <div className="seg">
            <button className={m === 'demo' ? 'on' : ''} onClick={() => setM('demo')}>Demo</button>
            <button className={m === 'live' ? 'on' : ''} onClick={() => setM('live')}>Live · Gemini</button>
          </div>
        </div>
        <div className="field">
          <label>Gemini API key (stored only in your browser)</label>
          <input type="password" placeholder="AIza…" value={key} onChange={(e) => setKeyLocal(e.target.value)} />
          <span className="faint" style={{ fontSize: 12 }}>
            Get one at aistudio.google.com/apikey. Never shared — kept in localStorage on this device.
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { setKey(key); onSave(m) }}>Save</button>
        </div>
      </div>
    </div>
  )
}

function BottomNav({ onHome, onSettings }: { onHome: () => void; onSettings: () => void }) {
  const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <nav className="bottomnav">
      <button className="navitem active" onClick={onHome}>
        <svg {...S}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>
        <span>Home</span>
      </button>
      <button className="navitem" onClick={onHome}>
        <svg {...S}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
        <span>Browse</span>
      </button>
      <button className="navitem scan" onClick={onHome} aria-label="Inspect a listing">
        <span className="scanbtn">
          <svg {...S}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" /><path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" /><path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" /><path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><circle cx="12" cy="12" r="3" /></svg>
        </span>
      </button>
      <button className="navitem" onClick={onHome}>
        <svg {...S}><path d="M6 4h12v16l-6-4-6 4z" /></svg>
        <span>Saved</span>
      </button>
      <button className="navitem" onClick={onSettings}>
        <svg {...S}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
        <span>You</span>
      </button>
    </nav>
  )
}

function Footer() {
  return (
    <div className="footer">
      <div className="container">
        <p className="attribution">
          Powered by <b>Google Gemini</b> via <b>Google AI Studio</b> · built &amp; shipped on <b>Replit</b>
        </p>
        <p className="disclaimer">
          Verdict is decision support, not a substitute for a professional pre-purchase inspection or a mechanic’s
          diagnosis. Photo screens cannot see engine internals or structural damage underneath. Findings and
          valuations are model-generated estimates grounded in the comparable listings shown. Always verify title,
          VIN history, and safety-critical items independently before buying.
        </p>
      </div>
    </div>
  )
}
