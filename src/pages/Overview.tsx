import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { PageHeader, Panel, StatCard, StatGrid, Table, Td, Loading, Pill, ago } from '../components/ui'

const GAMES = ['pokemon','mtg','yugioh','lorcana','onepiece','riftbound','digimon','dbsmasters','dbsfusion','swu']

export default function Overview() {
  const [flagCount, setFlagCount]   = useState<number | null>(null)
  const [lastSync, setLastSync]     = useState<any>(null)
  const [scansToday, setScansToday] = useState<number | null>(null)
  const [vpsUp, setVpsUp]           = useState<boolean | null>(null)
  const [gameCounts, setGameCounts] = useState<{ game: string; count: number }[]>([])

  useEffect(() => {
    const since = new Date(Date.now() - 86400000).toISOString()

    Promise.all([
      sb.from('price_flags').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      sb.from('sync_log').select('*').order('started_at', { ascending: false }).limit(1),
      sb.from('scan_log').select('*', { count: 'exact', head: true }).gte('created_at', since),
      fetch('http://78.46.150.213:8787/last', { signal: AbortSignal.timeout(3500) }).then(() => true).catch(() => false),
      Promise.all(GAMES.map(g => sb.from('card_prices').select('*', { count: 'exact', head: true }).eq('game', g).eq('kind', 'card'))),
    ]).then(([flags, sync, scans, vps, counts]) => {
      setFlagCount(flags.count ?? 0)
      setLastSync(sync.data?.[0] ?? null)
      setScansToday(scans.count ?? 0)
      setVpsUp(vps as boolean)
      setGameCounts(GAMES.map((g, i) => ({ game: g, count: counts[i].count ?? 0 })))
    })
  }, [])

  const syncTone = lastSync ? (lastSync.status === 'success' ? 'good' : 'bad') : undefined

  return (
    <>
      <PageHeader title="Dashboard" sub="App health at a glance" />
      <div className="p-7">
        <StatGrid>
          <StatCard
            label="VPS Matcher"
            value={vpsUp == null ? '…' : vpsUp ? 'Online' : 'Offline'}
            sub="78.46.150.213:8787"
            tone={vpsUp == null ? undefined : vpsUp ? 'good' : 'bad'}
          />
          <StatCard
            label="Open Flags"
            value={flagCount ?? '…'}
            sub={flagCount ? 'Price spikes pending' : 'All clear'}
            tone={flagCount ? 'warn' : 'good'}
          />
          <StatCard
            label="Last Sync"
            value={lastSync ? lastSync.status : '—'}
            sub={lastSync ? ago(lastSync.completed_at ?? lastSync.started_at) : 'No syncs yet'}
            tone={syncTone}
          />
          <StatCard
            label="Scans Today"
            value={scansToday ?? '…'}
            sub="from scan_log"
          />
        </StatGrid>

        <Panel title="Cards in Database">
          {!gameCounts.length ? <Loading /> : (
            <Table heads={['Game', 'Rows (kind=card)', 'Status']}>
              {gameCounts.map(({ game, count }) => (
                <tr key={game} className="hover:bg-white/2">
                  <Td>{game}</Td>
                  <Td mono>{count.toLocaleString()}</Td>
                  <Td><Pill tone={count > 0 ? 'green' : 'red'}>{count > 0 ? 'OK' : 'Empty'}</Pill></Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </>
  )
}
