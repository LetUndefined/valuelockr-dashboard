import { useEffect, useRef, useState } from 'react'
import { Chart, LineElement, BarElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler } from 'chart.js'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, StatCard, StatGrid, Table, Td, EmptyState, Loading } from '../components/ui'

Chart.register(LineElement, BarElement, PointElement, LinearScale, CategoryScale, ArcElement, Tooltip, Legend, Filler)

type ScanRow = { game: string | null; name: string | null; score: number | null; margin: number | null; created_at: string }

export default function ScanAnalytics() {
  const [scans, setScans]   = useState<ScanRow[]>([])
  const [loading, setLoading] = useState(true)
  const lineRef = useRef<HTMLCanvasElement>(null)
  const donutRef = useRef<HTMLCanvasElement>(null)
  const lineChart = useRef<Chart | null>(null)
  const donutChart = useRef<Chart | null>(null)

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    sb.from('scan_log').select('game,name,score,margin,created_at').gte('created_at', since).limit(5000)
      .then(({ data }) => { setScans(data ?? []); setLoading(false) })
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
    const COLORS = ['#5a6fff','#c9950f','#2a9d5c','#c94040','#4a7fa0','#9b59b6','#e67e22','#1abc9c','#e74c3c','#3498db']

    lineChart.current?.destroy()
    lineChart.current = new Chart(lineRef.current, {
      type: 'line',
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [{ data: days.map(d => dayMap[d]), borderColor: '#5a6fff', backgroundColor: 'rgba(90,111,255,0.1)', fill: true, tension: 0.3, pointRadius: 2 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6b6e8a', maxTicksLimit: 8 }, grid: { color: '#2a2d4a' } }, y: { ticks: { color: '#6b6e8a' }, grid: { color: '#2a2d4a' } } } },
    })

    donutChart.current?.destroy()
    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(gameMap),
        datasets: [{ data: Object.values(gameMap), backgroundColor: COLORS, borderWidth: 1, borderColor: '#1a1d35' }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#c8cae0', font: { size: 11 }, padding: 10 } } } },
    })
  }, [scans])

  const cardMap: Record<string, { game: string; count: number; scores: number[] }> = {}
  scans.forEach(r => {
    if (!r.name) return
    const k = `${r.game}||${r.name}`
    if (!cardMap[k]) cardMap[k] = { game: r.game ?? '', count: 0, scores: [] }
    cardMap[k].count++
    if (r.score != null) cardMap[k].scores.push(r.score)
  })
  const topCards = Object.entries(cardMap).sort((a, b) => b[1].count - a[1].count).slice(0, 20)
  const lowConf  = scans.filter(r => r.margin != null && r.margin < 0.01).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 30)

  const total = scans.length
  const avgScore  = total ? (scans.reduce((a, r) => a + (r.score ?? 0), 0) / total).toFixed(3) : '—'
  const avgMargin = total ? (scans.reduce((a, r) => a + (r.margin ?? 0), 0) / total).toFixed(4) : '—'

  return (
    <>
      <PageHeader title="Scan Analytics" sub="Camera scan activity from scan_log (last 30 days)" />
      <div className="p-7">
        {loading ? <Loading /> : !scans.length ? <EmptyState>No scan data in the last 30 days.</EmptyState> : (
          <>
            <StatGrid>
              <StatCard label="Total Scans" value={total.toLocaleString()} sub="last 30 days" />
              <StatCard label="Games Active" value={new Set(scans.map(r => r.game).filter(Boolean)).size} />
              <StatCard label="Avg Score"  value={avgScore} />
              <StatCard label="Avg Margin" value={avgMargin} />
            </StatGrid>

            <div className="grid grid-cols-2 gap-5 mb-6">
              <Panel title="Scans per Day">
                <div className="h-52"><canvas ref={lineRef} /></div>
              </Panel>
              <Panel title="By Game">
                <div className="h-52"><canvas ref={donutRef} /></div>
              </Panel>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Panel title="Top Scanned Cards">
                <Table heads={['Card', 'Game', 'Scans', 'Avg Score']}>
                  {topCards.map(([k, v]) => (
                    <tr key={k} className="hover:bg-white/2">
                      <Td>{k.split('||')[1]}</Td>
                      <Td mono>{v.game}</Td>
                      <Td mono>{v.count}</Td>
                      <Td mono>{v.scores.length ? (v.scores.reduce((a, b) => a + b) / v.scores.length).toFixed(3) : '—'}</Td>
                    </tr>
                  ))}
                </Table>
              </Panel>
              <Panel title="Low Confidence Scans">
                {lowConf.length ? (
                  <Table heads={['Card', 'Game', 'Margin', 'Score']}>
                    {lowConf.map((r, i) => (
                      <tr key={i} className="hover:bg-white/2">
                        <Td>{r.name ?? '—'}</Td>
                        <Td mono>{r.game ?? '—'}</Td>
                        <Td mono><span className="text-amber-400">{r.margin?.toFixed(4)}</span></Td>
                        <Td mono>{r.score?.toFixed(3)}</Td>
                      </tr>
                    ))}
                  </Table>
                ) : <EmptyState>No low-confidence scans 🎉</EmptyState>}
              </Panel>
            </div>
          </>
        )}
      </div>
    </>
  )
}
