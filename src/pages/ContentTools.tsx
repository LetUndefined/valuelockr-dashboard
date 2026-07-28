import { useState } from 'react'
import { sb, sbAdmin } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Btn, Loading, EmptyState, Field, Input, Select, eur } from '../components/ui'

type Row = { game: string; tcgid: string; name: string; set_name: string | null; card_number: string | null; cardmarket_eur: number | null; tcgplayer_usd: number | null; avg_30d: number | null }

export default function ContentTools() {
  const [game, setGame]     = useState('pokemon')
  const [query, setQuery]   = useState('')
  const [rows, setRows]     = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [newEur, setNewEur] = useState('')
  const [newUsd, setNewUsd] = useState('')
  const [saving, setSaving] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    const { data } = await sb.from('card_prices')
      .select('game,tcgid,name,set_name,card_number,cardmarket_eur,tcgplayer_usd,avg_30d')
      .eq('game', game).eq('kind', 'card').ilike('name', `%${query}%`).limit(30)
    setRows(data ?? [])
    setLoading(false)
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    const update: Record<string, number | null> = {}
    if (newEur !== '') update.cardmarket_eur = newEur ? parseFloat(newEur) : null
    if (newUsd !== '') update.tcgplayer_usd  = newUsd ? parseFloat(newUsd) : null
    if (Object.keys(update).length) {
      await sbAdmin.from('card_prices').update(update).eq('game', editing.game).eq('tcgid', editing.tcgid)
    }
    setSaving(false)
    setEditing(null)
    search()
  }

  return (
    <>
      <PageHeader title="Content Tools" sub="Manually edit card prices" />
      <div className="p-7">
        <Panel title="Search">
          <div className="flex gap-3 items-end">
            <div className="w-40">
              <Field label="Game">
                <Select value={game} onChange={e => setGame(e.target.value)}>
                  {['pokemon','mtg','yugioh','lorcana','onepiece','riftbound'].map(g => <option key={g} value={g}>{g}</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Card Name">
                <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Charizard" />
              </Field>
            </div>
            <Btn variant="ghost" onClick={search}>Search</Btn>
          </div>
        </Panel>

        {loading ? <Loading /> : rows.length ? (
          <Panel title="Results">
            <Table heads={['Name', 'Set', '#', 'EUR', 'USD', '30d Avg', 'Edit']}>
              {rows.map(r => (
                <tr key={r.tcgid} className="hover:bg-white/2">
                  <Td><strong>{r.name}</strong></Td>
                  <Td>{r.set_name ?? '—'}</Td>
                  <Td mono>{r.card_number ?? '—'}</Td>
                  <Td mono>{eur(r.cardmarket_eur)}</Td>
                  <Td mono>{r.tcgplayer_usd != null ? `$${Number(r.tcgplayer_usd).toFixed(2)}` : '—'}</Td>
                  <Td mono>{eur(r.avg_30d)}</Td>
                  <Td>
                    <Btn size="sm" variant="ghost" onClick={() => { setEditing(r); setNewEur(''); setNewUsd('') }}>Edit</Btn>
                  </Td>
                </tr>
              ))}
            </Table>
          </Panel>
        ) : query ? <EmptyState>No results for "{query}"</EmptyState> : null}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-7 w-96 max-w-[95vw]">
            <h3 className="text-[16px] font-bold text-heading mb-1">Edit Price</h3>
            <p className="text-[13px] text-muted mb-5">
              <strong className="text-text">{editing.name}</strong> · {editing.set_name ?? ''} #{editing.card_number ?? '?'}
            </p>
            <div className="flex flex-col gap-3 mb-5">
              <Field label={`EUR (current: ${eur(editing.cardmarket_eur)})`}>
                <Input type="number" step="0.01" value={newEur} onChange={e => setNewEur(e.target.value)} placeholder="Leave blank to keep" />
              </Field>
              <Field label={`USD (current: ${editing.tcgplayer_usd != null ? `$${Number(editing.tcgplayer_usd).toFixed(2)}` : '—'})`}>
                <Input type="number" step="0.01" value={newUsd} onChange={e => setNewUsd(e.target.value)} placeholder="Leave blank to keep" />
              </Field>
            </div>
            <div className="flex gap-2.5 justify-end">
              <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
