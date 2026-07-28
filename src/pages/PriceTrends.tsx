import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Loading, EmptyState, eur } from '../components/ui'

type Row = { game: string; name: string; card_number: string | null; set_name: string | null; cardmarket_eur: number; avg_30d: number; ratio: number }

export default function PriceTrends() {
  const [risers, setRisers]   = useState<Row[]>([])
  const [fallers, setFallers] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.from('card_prices')
      .select('game,name,card_number,set_name,cardmarket_eur,avg_30d')
      .eq('kind', 'card')
      .not('cardmarket_eur', 'is', null)
      .not('avg_30d', 'is', null)
      .gt('avg_30d', 2)
      .gt('cardmarket_eur', 0)
      .limit(5000)
      .then(({ data }) => {
        const rows = (data ?? []).map(r => ({ ...r, ratio: r.cardmarket_eur / r.avg_30d })) as Row[]
        setRisers(rows.filter(r => r.ratio > 1.3).sort((a, b) => b.ratio - a.ratio).slice(0, 25))
        setFallers(rows.filter(r => r.ratio < 0.7).sort((a, b) => a.ratio - b.ratio).slice(0, 25))
        setLoading(false)
      })
  }, [])

  const trow = (r: Row, cls: string) => (
    <tr key={`${r.game}-${r.name}-${r.card_number}`} className="hover:bg-white/2">
      <Td>
        <strong>{r.name}</strong>
        <br />
        <span className="text-muted text-[11px]">{r.set_name ?? ''} #{r.card_number ?? '?'}</span>
      </Td>
      <Td mono>{r.game}</Td>
      <Td mono>{eur(r.cardmarket_eur)}</Td>
      <Td mono>{eur(r.avg_30d)}</Td>
      <Td><span className={`font-bold ${cls}`}>{r.ratio.toFixed(2)}×</span></Td>
    </tr>
  )

  return (
    <>
      <PageHeader title="Price Trends" sub="Biggest movers vs 30-day average" />
      <div className="p-7">
        {loading ? <Loading /> : (
          <div className="grid grid-cols-2 gap-5">
            <Panel title="🔺 Biggest Risers">
              {risers.length ? (
                <Table heads={['Card', 'Game', 'Current', '30d Avg', 'Change']}>
                  {risers.map(r => trow(r, 'text-amber-400'))}
                </Table>
              ) : <EmptyState>No significant risers.</EmptyState>}
            </Panel>
            <Panel title="🔻 Biggest Fallers">
              {fallers.length ? (
                <Table heads={['Card', 'Game', 'Current', '30d Avg', 'Change']}>
                  {fallers.map(r => trow(r, 'text-price'))}
                </Table>
              ) : <EmptyState>No significant fallers.</EmptyState>}
            </Panel>
          </div>
        )}
      </div>
    </>
  )
}
