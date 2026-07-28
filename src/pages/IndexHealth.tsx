import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Btn, Loading, Field, Input, fmt } from '../components/ui'

const GAMES = ['pokemon','yugioh','mtg','lorcana','onepiece','digimon','dbsmasters','dbsfusion','swu','riftbound']
const DEFAULT_INDEX: Record<string, number> = {
  pokemon: 27140, yugioh: 43384, mtg: 93331, lorcana: 2479, onepiece: 6298,
  digimon: 8618, dbsmasters: 10181, dbsfusion: 3875, swu: 7852, riftbound: 1150,
}

type IndexMeta = Record<string, { count: number; deployedAt: string | null }>

function loadMeta(): IndexMeta {
  try { return JSON.parse(localStorage.getItem('vl_index_meta') ?? '{}') } catch { return {} }
}

export default function IndexHealth() {
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({})
  const [meta, setMeta]         = useState<IndexMeta>(loadMeta)
  const [loading, setLoading]   = useState(true)
  const [dates, setDates]       = useState<Record<string, string>>(() => {
    const m = loadMeta()
    return Object.fromEntries(GAMES.map(g => [g, m[g]?.deployedAt ?? '']))
  })

  useEffect(() => {
    Promise.all(GAMES.map(g =>
      sb.from('card_prices').select('*', { count: 'exact', head: true }).eq('game', g).eq('kind', 'card')
    )).then(results => {
      setDbCounts(Object.fromEntries(GAMES.map((g, i) => [g, results[i].count ?? 0])))
      setLoading(false)
    })
  }, [])

  function saveDates() {
    const updated: IndexMeta = {}
    GAMES.forEach(g => {
      updated[g] = { count: meta[g]?.count ?? DEFAULT_INDEX[g], deployedAt: dates[g] || null }
    })
    setMeta(updated)
    localStorage.setItem('vl_index_meta', JSON.stringify(updated))
    alert('Saved.')
  }

  return (
    <>
      <PageHeader title="Index Health" sub="Embedding index vs database drift" />
      <div className="p-7">
        <Panel title="Status">
          <p className="text-[13px] text-muted mb-4">Cards added since the last index deploy cannot be matched by camera. Rebuild when drift is large.</p>
          {loading ? <Loading /> : (
            <Table heads={['Game', 'DB Rows', 'Index Size', 'Drift', 'Last Deploy']}>
              {GAMES.map(g => {
                const db  = dbCounts[g] ?? 0
                const idx = meta[g]?.count ?? DEFAULT_INDEX[g]
                const drift = db - idx
                return (
                  <tr key={g} className="hover:bg-white/2">
                    <Td>{g}</Td>
                    <Td mono>{db.toLocaleString()}</Td>
                    <Td mono>{idx.toLocaleString()}</Td>
                    <Td>
                      {drift > 500
                        ? <span className="text-amber-400 font-bold">+{drift.toLocaleString()} missing</span>
                        : drift > 0
                        ? <span className="text-muted">+{drift}</span>
                        : <span className="text-emerald-400">In sync</span>}
                    </Td>
                    <Td mono>{fmt(meta[g]?.deployedAt)}</Td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Panel>

        <Panel title="Update Deploy Dates" action={<Btn size="sm" variant="primary" onClick={saveDates}>Save</Btn>}>
          <p className="text-[13px] text-muted mb-4">After uploading a rebuilt index to the VPS, record the date here.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {GAMES.map(g => (
              <Field key={g} label={g}>
                <Input type="date" value={dates[g]} onChange={e => setDates(prev => ({ ...prev, [g]: e.target.value }))} />
              </Field>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}
