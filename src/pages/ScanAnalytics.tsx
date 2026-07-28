import { useEffect, useRef, useState } from 'react'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, StatCard, StatGrid, Table, Td, EmptyState, Loading, GamePill, ConfidenceDot, ago } from '../components/ui'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler)

type Scan = {
  id: string; game: string | null; name: string | null; set_name: string | null
  number: string | null; source_id: string | null; score: number | null
  margin: number | null; reranked: boolean | null; detect_ms: number | null
  embed_ms: number | null; created_at: string
}

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#555', maxTicksLimit: 8 }, grid: { color: '#1a1a1a' } },
    y: { ticks: { color: '#555' }, grid: { color: '#1a1a1a' } },
  },
}

export default function ScanAnalytics() {
  const [scans, setScans]     = useState<Scan[]>([])
  const [recent, setRecent]   = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'feed' | 'top' | 'lowconf'>('feed')
  const lineRef  = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const lineChart  = useRef<Chart | null>(null)
  const donutChart = useRef<Chart | null>(null)

  useEffect(() => {
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString()
    Promise.all([
      sb.from('scan_log').select('*').gte('created_at', since30d).order('created_at', { ascending: false }).limit(5000),
      sb.from('scan_log').select('*').order('created_at', { ascending: false }).limit(100),
    ]).then(([agg, rec]) => {
      setScans(agg.data ?? [])
      setRecent(rec.data ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!scans.length || !lineRef.current || !donutRef.current) return

    const dayMap: Record<string, number> = {}
    const gameMap: Record<string, number> = {}
    scans.forEach(r => {
      const d = r.created_at.slice(0, 10)
      dayMap[d] = (dayMap[d] ?? 0) + 1
      if (r.game) gameMap[r.game] = (gameMap[r.game] ?? 0) + 1
    })
    const days = Object.keys(dayMap).sort()

    const COLORS = ['#00e676','#fbbf24','#7aa8c7','#ef4444','#a78bfa','#f97316','#34d399','#60a5fa','#f472b6','#94a3b8']

    lineChart.current?.destroy()
    lineChart.current = new Chart(lineRef.current, {
      type: 'line',
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [{ data: days.map(d => dayMap[d]), borderColor: '#00e676', backgroundColor: 'rgba(0,230,118,0.06)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 1.5 }],
      },
      options: CHART_OPTS,
    })

    donutChart.current?.destroy()
    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(gameMap),
        datasets: [{ data: Object.values(gameMap), backgroundColor: COLORS, borderWidth: 1, borderColor: '#0a0a0a' }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#777', font: { size: 11 }, padding: 12 } } } },
    })
  }, [scans])

  const cardMap: Record<string, { game: string; count: number; scores: number[]; margins: number[] }> = {}
  scans.forEach(r => {
    if (!r.name) return
    const k = `${r.game}||${r.name}||${r.number}`
    if (!cardMap[k]) cardMap[k] = { game: r.game ?? '', count: 0, scores: [], margins: [] }
    cardMap[k].count++
    if (r.score  != null) cardMap[k].scores.push(r.score)
    if (r.margin != null) cardMap[k].margins.push(r.margin)
  })
  const topCards = Object.entries(cardMap).sort((a, b) => b[1].count - a[1].count).slice(0, 30)
  const lowConf  = scans.filter(r => r.margin != null && r.margin < 0.005).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 50)

  const total      = scans.length
  const today      = scans.filter(r => r.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const avgScore   = total ? (scans.reduce((a, r) => a + (r.score ?? 0), 0) / total).toFixed(3) : '—'
  const avgMargin  = total ? (scans.reduce((a, r) => a + (r.margin ?? 0), 0) / total).toFixed(4) : '—'
  const locked     = scans.filter(r => (r.margin ?? 0) >= 0.02).length
  const lockRate   = total ? `${((locked / total) * 100).toFixed(0)}%` : '—'

  const TABS = [
    { id: 'feed',    label: 'Recent Scans' },
    { id: 'top',     label: 'Top Cards' },
    { id: 'lowconf', label: 'Low Confidence' },
  ] as const

  return (
    <>
      <PageHeader title="Scan Analytics" sub="Everything the camera sees — last 30 days" />
      <div className="p-7">

        {loading ? <Loading /> : !scans.length ? (
          <div className="bg-elevated border border-border rounded-2xl p-8">
            <p className="text-white font-semibold mb-2">No scan data yet</p>
            <p className="text-sub text-[13px] mb-4">The matcher server logs scans to Supabase after each match. To enable it:</p>
            <ol className="text-sub text-[13px] space-y-2 list-decimal list-inside">
              <li>Create the <code className="text-price bg-elevated px-1 py-0.5 rounded">scan_log</code> table in Supabase (SQL in the README)</li>
              <li>Add a <code className="text-price bg-elevated px-1 py-0.5 rounded">.env</code> file to <code className="text-price bg-elevated px-1 py-0.5 rounded">/opt/matcher/</code> on the VPS with <code className="text-price bg-elevated px-1 py-0.5 rounded">EXPO_PUBLIC_SUPABASE_URL</code> and <code className="text-price bg-elevated px-1 py-0.5 rounded">SUPABASE_SERVICE_KEY</code></li>
              <li>Run <code className="text-price bg-elevated px-1 py-0.5 rounded">systemctl restart matcher</code></li>
            </ol>
          </div>
        ) : (
          <>
            <StatGrid>
              <StatCard label="Total (30d)"    value={total.toLocaleString('en-US')} />
              <StatCard label="Today"          value={today.toLocaleString('en-US')} />
              <StatCard label="Lock Rate"      value={lockRate} sub="margin ≥ 0.02" tone={locked/total > 0.7 ? 'good' : 'warn'} />
              <StatCard label="Avg Confidence" value={avgMargin} />
            </StatGrid>

            {/* Charts */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                  <span className="text-[13px] font-semibold text-white">Scans per Day</span>
                </div>
                <div className="p-5 h-48"><canvas ref={lineRef} /></div>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                  <span className="text-[13px] font-semibold text-white">By Game</span>
                </div>
                <div className="p-5 h-48"><canvas ref={donutRef} /></div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex border-b border-border">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-5 py-3.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${
                      tab === t.id ? 'border-green text-green' : 'border-transparent text-sub hover:text-white'
                    }`}
                  >
                    {t.label}
                    {t.id === 'lowconf' && lowConf.length > 0 && (
                      <span className="ml-2 bg-red/20 text-red text-[10px] px-1.5 py-0.5 rounded-full font-bold">{lowConf.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {tab === 'feed' && (
                <div>
                  {recent.length ? recent.map((r, i) => (
                    <div key={r.id ?? i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-elevated/40 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                        background: (r.margin ?? 0) >= 0.02 ? '#00e676' : (r.margin ?? 0) >= 0.005 ? '#fbbf24' : '#ef4444',
                        boxShadow: `0 0 6px ${(r.margin ?? 0) >= 0.02 ? '#00e676' : (r.margin ?? 0) >= 0.005 ? '#fbbf24' : '#ef4444'}`,
                      }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-[13px]">{r.name ?? '—'}</span>
                          {r.game && <GamePill game={r.game} />}
                          {r.reranked && <span className="text-[9px] text-price bg-price/10 px-1.5 py-0.5 rounded-full font-bold">RERANKED</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {r.set_name && <span className="text-[11px] text-sub">{r.set_name}</span>}
                          {r.number   && <span className="text-[11px] text-muted">#{r.number}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-3 justify-end">
                          <div className="text-center">
                            <p className="text-[9px] text-muted uppercase tracking-wider">Score</p>
                            <p className="text-[12px] font-mono text-price">{r.score?.toFixed(3) ?? '—'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] text-muted uppercase tracking-wider">Margin</p>
                            <p className="text-[12px] font-mono"><ConfidenceDot margin={r.margin} /></p>
                          </div>
                          <div className="text-center hidden sm:block">
                            <p className="text-[9px] text-muted uppercase tracking-wider">Speed</p>
                            <p className="text-[12px] font-mono text-sub">{r.embed_ms != null ? `${r.embed_ms}ms` : '—'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted shrink-0 w-16 text-right">{ago(r.created_at)}</div>
                    </div>
                  )) : <EmptyState>No recent scans.</EmptyState>}
                </div>
              )}

              {tab === 'top' && (
                <div className="p-5">
                  <Table heads={['Card', 'Game', '#', 'Scans', 'Avg Score', 'Avg Margin']}>
                    {topCards.map(([k, v]) => {
                      const [, name, num] = k.split('||')
                      const avgS = v.scores.length  ? (v.scores.reduce((a,b)=>a+b)/v.scores.length).toFixed(3) : '—'
                      const avgM = v.margins.length ? (v.margins.reduce((a,b)=>a+b)/v.margins.length) : null
                      return (
                        <tr key={k} className="hover:bg-elevated/40">
                          <Td><span className="font-semibold">{name}</span></Td>
                          <Td><GamePill game={v.game} /></Td>
                          <Td mono>{num !== 'undefined' ? `#${num}` : '—'}</Td>
                          <Td mono>{v.count}</Td>
                          <Td mono>{avgS}</Td>
                          <Td><ConfidenceDot margin={avgM} /></Td>
                        </tr>
                      )
                    })}
                  </Table>
                </div>
              )}

              {tab === 'lowconf' && (
                <div className="p-5">
                  <p className="text-[12px] text-sub mb-4">Scans with margin &lt; 0.005 — the matcher wasn't confident. These indicate cards that may be missing from or underrepresented in the embedding index.</p>
                  {lowConf.length ? (
                    <Table heads={['Card', 'Game', 'Set', '#', 'Score', 'Margin', 'Detect', 'Embed', 'When']}>
                      {lowConf.map((r, i) => (
                        <tr key={r.id ?? i} className="hover:bg-elevated/40">
                          <Td><span className="font-semibold">{r.name ?? '—'}</span></Td>
                          <Td>{r.game ? <GamePill game={r.game} /> : '—'}</Td>
                          <Td><span className="text-sub text-[11px]">{r.set_name ?? '—'}</span></Td>
                          <Td mono>{r.number ? `#${r.number}` : '—'}</Td>
                          <Td mono>{r.score?.toFixed(3) ?? '—'}</Td>
                          <Td><ConfidenceDot margin={r.margin} /></Td>
                          <Td mono>{r.detect_ms != null ? `${r.detect_ms}ms` : '—'}</Td>
                          <Td mono>{r.embed_ms  != null ? `${r.embed_ms}ms`  : '—'}</Td>
                          <Td><span className="text-muted text-[11px]">{ago(r.created_at)}</span></Td>
                        </tr>
                      ))}
                    </Table>
                  ) : <EmptyState>No low-confidence scans 🎉</EmptyState>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
