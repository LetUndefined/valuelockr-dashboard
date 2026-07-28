import { useEffect, useState } from 'react'
import { sb, sbAdmin } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Pill, Btn, EmptyState, Loading, eur, ago } from '../components/ui'

type Flag = {
  id: string; game: string; tcgid: string; name: string; set_name: string | null
  card_number: string | null; old_price: number | null; new_price: number
  avg_30d: number | null; ratio: number | null; flagged_at: string
  resolved_at: string | null; resolution: string | null; resolved_price: number | null
}

export default function PriceFlags() {
  const [open, setOpen]         = useState<Flag[]>([])
  const [resolved, setResolved] = useState<Flag[]>([])
  const [loading, setLoading]   = useState(true)
  const [customId, setCustomId] = useState<Flag | null>(null)
  const [customVal, setCustomVal] = useState('')

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [o, r] = await Promise.all([
      sb.from('price_flags').select('*').is('resolved_at', null).order('flagged_at', { ascending: false }).limit(100),
      sb.from('price_flags').select('*').not('resolved_at', 'is', null).gte('resolved_at', since).order('resolved_at', { ascending: false }).limit(50),
    ])
    setOpen(o.data ?? [])
    setResolved(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resolve(f: Flag, resolution: 'accepted' | 'kept_old' | 'custom', price: number | null) {
    if (resolution === 'accepted') {
      await sbAdmin.from('card_prices').update({ cardmarket_eur: f.new_price }).eq('game', f.game).eq('tcgid', f.tcgid)
    }
    if (resolution === 'custom' && price != null) {
      await sbAdmin.from('card_prices').update({ cardmarket_eur: price }).eq('game', f.game).eq('tcgid', f.tcgid)
    }
    await sbAdmin.from('price_flags').update({ resolved_at: new Date().toISOString(), resolution, resolved_price: price }).eq('id', f.id)
    load()
  }

  const resColor: Record<string, 'green' | 'blue' | 'warn'> = { accepted: 'green', kept_old: 'blue', custom: 'warn' }

  return (
    <>
      <PageHeader title="Price Flags" sub="Suspicious price spikes from the overnight sync" />
      <div className="p-7">
        <Panel title="Open Flags" action={<Pill tone={open.length ? 'warn' : 'green'}>{open.length} open</Pill>}>
          {loading ? <Loading /> : open.length ? (
            <Table heads={['Card', 'Set', '#', 'Old', 'New', '30d Avg', 'Ratio', 'Flagged', 'Actions']}>
              {open.map(f => (
                <tr key={f.id} className="hover:bg-white/2">
                  <Td><strong>{f.name}</strong></Td>
                  <Td>{f.set_name ?? '—'}</Td>
                  <Td mono>{f.card_number ?? '—'}</Td>
                  <Td mono>{eur(f.old_price)}</Td>
                  <Td mono><span className="text-amber-400">{eur(f.new_price)}</span></Td>
                  <Td mono>{eur(f.avg_30d)}</Td>
                  <Td>
                    {f.ratio != null
                      ? <span className={f.ratio > 3 ? 'text-red-400 font-bold' : 'text-amber-400 font-bold'}>{f.ratio}×</span>
                      : '—'}
                  </Td>
                  <Td><span className="text-muted">{ago(f.flagged_at)}</span></Td>
                  <Td>
                    <div className="flex gap-1.5 flex-wrap">
                      <Btn size="sm" variant="green" onClick={() => resolve(f, 'accepted', f.new_price)}>✓ Accept</Btn>
                      <Btn size="sm" variant="ghost"  onClick={() => resolve(f, 'kept_old', null)}>✗ Keep Old</Btn>
                      <Btn size="sm" variant="warn"   onClick={() => { setCustomId(f); setCustomVal('') }}>✎ Custom</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No open flags 🎉</EmptyState>}
        </Panel>

        <Panel title="Resolved (last 30 days)">
          {loading ? <Loading /> : resolved.length ? (
            <Table heads={['Card', 'Set', 'Old', 'New', 'Resolution', 'Final Price', 'Resolved']}>
              {resolved.map(f => (
                <tr key={f.id} className="hover:bg-white/2">
                  <Td><strong>{f.name}</strong></Td>
                  <Td>{f.set_name ?? '—'}</Td>
                  <Td mono>{eur(f.old_price)}</Td>
                  <Td mono>{eur(f.new_price)}</Td>
                  <Td><Pill tone={resColor[f.resolution ?? ''] ?? 'muted'}>{f.resolution?.replace('_', ' ') ?? '—'}</Pill></Td>
                  <Td mono>{eur(f.resolved_price)}</Td>
                  <Td><span className="text-muted">{ago(f.resolved_at)}</span></Td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No resolved flags yet.</EmptyState>}
        </Panel>
      </div>

      {customId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-7 w-96 max-w-[95vw]">
            <h3 className="text-[16px] font-bold text-heading mb-1">Set Custom Price</h3>
            <p className="text-[13px] text-muted mb-5">Enter the correct EUR price for <strong className="text-text">{customId.name}</strong></p>
            <input
              type="number" step="0.01" placeholder="12.50"
              value={customVal} onChange={e => setCustomVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customVal) { resolve(customId, 'custom', parseFloat(customVal)); setCustomId(null) } }}
              className="bg-surface border border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-accent w-full mb-5"
              autoFocus
            />
            <div className="flex gap-2.5 justify-end">
              <Btn variant="ghost" onClick={() => setCustomId(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={() => { if (customVal) { resolve(customId, 'custom', parseFloat(customVal)); setCustomId(null) } }}>Save</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
