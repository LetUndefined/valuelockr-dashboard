import { useEffect, useRef, useState, useMemo } from 'react'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import { sbAdmin } from '../lib/supabase'
import { PageHeader, StatCard, StatGrid, Table, Td, EmptyState, Loading, GamePill, ConfidenceDot, ago } from '../components/ui'

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

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function ScanAnalytics() {
  const [scans, setScans]     = useState<Scan[]>([])
  const [recent, setRecent]   = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'feed' | 'top' | 'lowconf' | 'heatmap' | 'misses'>('feed')
  const [game, setGame]       = useState('all')
  const [search, setSearch]   = useState('')
  const lineRef  = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const lineChart  = useRef<Chart | null>(null)
  const donutChart = useRef<Chart | null>(null)

  useEffect(() => {
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString()
    Promise.all([
      sbAdmin.from('scan_log').select('*').gte('created_at', since30d).order('created_at', { ascending: false }).limit(5000),
      sbAdmin.from('scan_log').select('*').order('created_at', { ascending: false }).limit(500),
    ]).then(([agg, rec]) => {
      setScans(agg.data ?? [])
      setRecent(rec.data ?? [])
      setLoading(false)
    })
  }, [])

  const games = useMemo(() => ['all', ...Array.from(new Set(scans.map(r => r.game).filter(Boolean) as string[]))], [scans])

  const filtered = useMemo(() => scans.filter(r => game === 'all' || r.game === game), [scans, game])
  const filteredRecent = useMemo(() => {
    const q = search.toLowerCase()
    return recent
      .filter(r => game === 'all' || r.game === game)
      .filter(r => !q || (r.name ?? '').toLowerCase().includes(q) || (r.set_name ?? '').toLowerCase().includes(q))
  }, [recent, game, search])

  useEffect(() => {
    if (!filtered.length || !lineRef.current || !donutRef.current) return

    const dayMap: Record<string, number> = {}
    const gameMap: Record<string, number> = {}
    filtered.forEach(r => {
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
  }, [filtered])

  const cardMap = useMemo(() => {
    const m: Record<string, { game: string; count: number; scores: number[]; margins: number[] }> = {}
    filtered.forEach(r => {
      if (!r.name) return
      const k = `${r.game}||${r.name}||${r.number}`
      if (!m[k]) m[k] = { game: r.game ?? '', count: 0, scores: [], margins: [] }
      m[k].count++
      if (r.score  != null) m[k].scores.push(r.score)
      if (r.margin != null) m[k].margins.push(r.margin)
    })
    return m
  }, [filtered])

  const topCards = useMemo(() => Object.entries(cardMap).sort((a, b) => b[1].count - a[1].count).slice(0, 30), [cardMap])
  const lowConf  = useMemo(() => filtered.filter(r => r.margin != null && r.margin < 0.005).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 50), [filtered])

  // Top misses: cards scanned 3+ times with consistently low margin
  const topMisses = useMemo(() =>
    Object.entries(cardMap)
      .map(([k, v]) => ({ k, ...v, avgMargin: v.margins.length ? v.margins.reduce((a,b)=>a+b)/v.margins.length : 1 }))
      .filter(v => v.count >= 2 && v.avgMargin < 0.01)
      .sort((a, b) => b.count - a.count || a.avgMargin - b.avgMargin)
      .slice(0, 30)
  , [cardMap])

  // Heatmap: day of week × hour
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    filtered.forEach(r => {
      const d = new Date(r.created_at)
      grid[d.getDay()][d.getHours()]++
    })
    const max = Math.max(1, ...grid.flat())
    return { grid, max }
  }, [filtered])

  const total     = filtered.length
  const today     = filtered.filter(r => r.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const avgMargin = total ? (filtered.reduce((a, r) => a + (r.margin ?? 0), 0) / total).toFixed(4) : '—'
  const locked    = filtered.filter(r => (r.margin ?? 0) >= 0.02).length
  const lockRate  = total ? `${((locked / total) * 100).toFixed(0)}%` : '—'

  const TABS = [
    { id: 'feed',    label: 'Recent Scans' },
    { id: 'top',     label: 'Top Cards' },
    { id: 'lowconf', label: 'Low Confidence' },
    { id: 'misses',  label: 'Top Misses' },
    { id: 'heatmap', label: 'Heatmap' },
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
              <li>Create the <code className="text-price bg-elevated px-1 py-0.5 rounded">scan_log</code> table in Supabase</li>
              <li>Add <code className="text-price bg-elevated px-1 py-0.5 rounded">EXPO_PUBLIC_SUPABASE_URL</code> and <code className="text-price bg-elevated px-1 py-0.5 rounded">SUPABASE_SERVICE_KEY</code> to <code className="text-price bg-elevated px-1 py-0.5 rounded">/opt/matcher/.env</code></li>
              <li>Run <code className="text-price bg-elevated px-1 py-0.5 rounded">systemctl restart matcher</code></li>
            </ol>
          </div>
        ) : (
          <>
            {/* Game filter */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {games.map(g => (
                <button
                  key={g}
                  onClick={() => setGame(g)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                    game === g ? 'bg-green text-black' : 'bg-elevated text-sub hover:text-white border border-border'
                  }`}
                >
                  {g === 'all' ? 'All Games' : g}
                </button>
              ))}
            </div>

            <StatGrid>
              <StatCard label="Total (30d)"    value={total.toLocaleString('en-US')} />
              <StatCard label="Today"          value={today.toLocaleString('en-US')} />
              <StatCard label="Lock Rate"      value={lockRate} sub="margin ≥ 0.02" tone={total && locked/total > 0.7 ? 'good' : 'warn'} />
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
              <div className="flex items-center border-b border-border gap-0 overflow-x-auto">
                <div className="flex flex-1">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`px-4 py-3.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                        tab === t.id ? 'border-green text-green' : 'border-transparent text-sub hover:text-white'
                      }`}
                    >
                      {t.label}
                      {t.id === 'lowconf' && lowConf.length > 0 && (
                        <span className="ml-1.5 bg-red/20 text-red text-[9px] px-1.5 py-0.5 rounded-full font-bold">{lowConf.length}</span>
                      )}
                      {t.id === 'misses' && topMisses.length > 0 && (
                        <span className="ml-1.5 bg-amber/20 text-amber text-[9px] px-1.5 py-0.5 rounded-full font-bold">{topMisses.length}</span>
                      )}
                    </button>
                  ))}
                </div>
                {tab === 'feed' && (
                  <div className="px-3 shrink-0">
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search card or set…"
                      className="bg-elevated border border-border text-white px-3 py-1.5 rounded-lg text-[12px] outline-none focus:border-green/50 w-44 placeholder:text-muted"
                    />
                  </div>
                )}
              </div>

              {tab === 'feed' && (
                <div>
                  {filteredRecent.length ? filteredRecent.map((r, i) => (
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
                      <div className="flex items-center gap-3 shrink-0">
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
                      <div className="text-[11px] text-muted shrink-0 w-16 text-right">{ago(r.created_at)}</div>
                    </div>
                  )) : <EmptyState>No scans match.</EmptyState>}
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
                  <p className="text-[12px] text-sub mb-4">Scans with margin &lt; 0.005 — matcher wasn't confident. Cards likely missing or underrepresented in the embedding index.</p>
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
                  ) : <EmptyState>No low-confidence scans.</EmptyState>}
                </div>
              )}

              {tab === 'misses' && (
                <div className="p-5">
                  <p className="text-[12px] text-sub mb-4">Cards scanned multiple times with consistently low confidence. These are the best candidates to add to or retrain in the embedding index.</p>
                  {topMisses.length ? (
                    <Table heads={['Card', 'Game', 'Times Scanned', 'Avg Margin', 'Priority']}>
                      {topMisses.map(v => {
                        const [, name] = v.k.split('||')
                        const priority = v.count >= 5 ? { label: 'High', cls: 'text-red' } : v.count >= 3 ? { label: 'Med', cls: 'text-amber' } : { label: 'Low', cls: 'text-sub' }
                        return (
                          <tr key={v.k} className="hover:bg-elevated/40">
                            <Td><span className="font-semibold">{name}</span></Td>
                            <Td><GamePill game={v.game} /></Td>
                            <Td mono>{v.count}</Td>
                            <Td><ConfidenceDot margin={v.avgMargin} /></Td>
                            <Td><span className={`font-bold text-[11px] ${priority.cls}`}>{priority.label}</span></Td>
                          </tr>
                        )
                      })}
                    </Table>
                  ) : <EmptyState>No repeat misses — index is healthy.</EmptyState>}
                </div>
              )}

              {tab === 'heatmap' && (
                <div className="p-5">
                  <p className="text-[12px] text-sub mb-4">When people scan — by day of week and hour (UTC).</p>
                  <div className="overflow-x-auto">
                    <table className="border-collapse text-[10px]">
                      <thead>
                        <tr>
                          <th className="w-10 pr-3 text-muted font-normal text-right" />
                          {Array.from({ length: 24 }, (_, h) => (
                            <th key={h} className="w-7 text-center text-muted font-normal pb-2">{h === 0 || h % 4 === 0 ? `${h}h` : ''}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmap.grid.map((row, d) => (
                          <tr key={d}>
                            <td className="pr-3 text-muted text-right py-0.5 whitespace-nowrap">{DAYS[d]}</td>
                            {row.map((val, h) => {
                              const intensity = val / heatmap.max
                              const bg = intensity === 0 ? '#1a1a1a' : `rgba(0,230,118,${Math.max(0.08, intensity * 0.9)})`
                              return (
                                <td key={h} title={`${DAYS[d]} ${h}:00 — ${val} scans`}
                                  style={{ background: bg, width: 26, height: 22, borderRadius: 3 }}
                                  className="cursor-default"
                                />
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-[10px] text-muted">Less</span>
                      {[0.08, 0.25, 0.5, 0.75, 1].map(i => (
                        <div key={i} style={{ background: `rgba(0,230,118,${i})`, width: 16, height: 16, borderRadius: 2 }} />
                      ))}
                      <span className="text-[10px] text-muted">More</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
