import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, EmptyState, Loading, ago } from '../components/ui'

export default function SearchGaps() {
  const [rows, setRows]     = useState<{ query: string; game: string | null; count: number; last: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    sb.from('search_log')
      .select('query,game,searched_at')
      .eq('result_count', 0)
      .gte('searched_at', since)
      .order('searched_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        const grouped: Record<string, { query: string; game: string | null; count: number; last: string }> = {}
        for (const r of data ?? []) {
          const k = `${r.game}||${r.query}`
          if (!grouped[k]) grouped[k] = { query: r.query, game: r.game, count: 0, last: r.searched_at }
          grouped[k].count++
          if (r.searched_at > grouped[k].last) grouped[k].last = r.searched_at
        }
        setRows(Object.values(grouped).sort((a, b) => b.count - a.count))
        setLoading(false)
      })
  }, [])

  return (
    <>
      <PageHeader title="Search Gaps" sub="Queries that returned zero results (last 30 days)" />
      <div className="p-7">
        <Panel title="No-Result Queries">
          <p className="text-[13px] text-muted mb-4">
            Requires <code className="text-steel">search_log</code> inserts from the app after each search call. If empty, add a fire-and-forget insert to <code className="text-steel">services/supabase.ts</code>.
          </p>
          {loading ? <Loading /> : rows.length ? (
            <Table heads={['Query', 'Game', 'Count', 'Last Searched']}>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-white/2">
                  <Td><strong>{r.query}</strong></Td>
                  <Td mono>{r.game ?? 'all'}</Td>
                  <Td mono>{r.count}</Td>
                  <Td><span className="text-muted">{ago(r.last)}</span></Td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No data yet — add search_log inserts to services/supabase.ts</EmptyState>}
        </Panel>
      </div>
    </>
  )
}
