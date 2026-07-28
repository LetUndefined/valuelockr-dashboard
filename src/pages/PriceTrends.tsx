import { useEffect, useState, useMemo } from 'react'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Loading, EmptyState, GamePill, eur } from '../components/ui'

type Row = { game: string; name: string; card_number: string | null; set_name: string | null; cardmarket_eur: number; avg_30d: number; ratio: number }

const GAMES = ['all','pokemon','mtg','yugioh','lorcana','onepiece','riftbound','digimon','dbsmasters','dbsfusion','swu']

export default function PriceTrends() {
  const [rows, setRows]     = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [game, setGame]     = useState('all')
  const [search, setSearch] = useState('')

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
        setRows((data ?? []).map(r => ({ ...r, ratio: r.cardmarket_eur / r.avg_30d })) as Row[])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows
      .filter(r => game === 'all' || r.game === game)
      .filter(r => !q || r.name.toLowerCase().includes(q) || (r.set_name ?? '').toLowerCase().includes(q))
  }, [rows, game, search])

  const risers  = useMemo(() => filtered.filter(r => r.ratio > 1.3).sort((a, b) => b.ratio - a.ratio).slice(0, 25), [filtered])
  const fallers = useMemo(() => filtered.filter(r => r.ratio < 0.7).sort((a, b) => a.ratio - b.ratio).slice(0, 25), [filtered])

  const trow = (r: Row, cls: string) => (
    <tr key={`${r.game}-${r.name}-${r.card_number}`} className="hover:bg-elevated/40">
      <Td>
        <strong>{r.name}</strong>
        <br />
        <span className="text-muted text-[11px]">{r.set_name ?? ''} {r.card_number ? `#${r.card_number}` : ''}</span>
      </Td>
      <Td><GamePill game={r.game} /></Td>
      <Td mono>{eur(r.cardmarket_eur)}</Td>
      <Td mono>{eur(r.avg_30d)}</Td>
      <Td><span className={`font-bold ${cls}`}>{r.ratio.toFixed(2)}×</span></Td>
    </tr>
  )

  return (
    <>
      <PageHeader title="Price Trends" sub="Biggest movers vs 30-day average" />
      <div className="p-7">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {GAMES.map(g => (
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
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search card or set…"
            className="bg-elevated border border-border text-white px-3 py-1.5 rounded-lg text-[12px] outline-none focus:border-green/50 w-48 placeholder:text-muted ml-auto"
          />
        </div>

        {loading ? <Loading /> : (
          <div className="grid grid-cols-2 gap-5">
            <Panel title="🔺 Biggest Risers">
              {risers.length ? (
                <Table heads={['Card', 'Game', 'Current', '30d Avg', 'Change']}>
                  {risers.map(r => trow(r, 'text-amber'))}
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
