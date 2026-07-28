import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'
import { GITHUB_TOKEN, GITHUB_REPO, SYNC_PASSWORD } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Pill, Btn, EmptyState, Loading, ago, fmt } from '../components/ui'

type SyncRun = {
  id: string; started_at: string; completed_at: string | null
  status: string; rows_updated: number; rows_skipped: number
  rows_flagged: number; error_message: string | null
}

function dur(r: SyncRun) {
  if (!r.completed_at) return '—'
  const ms = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()
  return ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`
}

const statusTone: Record<string, 'green' | 'red' | 'blue' | 'warn'> = {
  success: 'green', error: 'red', running: 'blue', partial: 'warn',
}

export default function Sync() {
  const [runs, setRuns]       = useState<SyncRun[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [pwd, setPwd]         = useState('')
  const [pwdErr, setPwdErr]   = useState(false)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    sb.from('sync_log').select('*').order('started_at', { ascending: false }).limit(30)
      .then(({ data }) => { setRuns(data ?? []); setLoading(false) })
  }, [])

  async function triggerSync() {
    if (pwd !== SYNC_PASSWORD) { setPwdErr(true); return }
    setPwdErr(false)
    setTriggering(true)
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/sync-prices.yml/dispatches`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' }),
      })
      if (res.ok || res.status === 204) {
        alert('✓ Sync triggered. Check the Builds tab or GitHub Actions.')
        setModal(false)
      } else {
        alert(`Failed: ${res.status}`)
      }
    } finally {
      setTriggering(false)
    }
  }

  return (
    <>
      <PageHeader title="Sync History" sub="Nightly sync runs and manual trigger" />
      <div className="p-7">
        <Panel title="Manual Sync" action={<Btn variant="warn" onClick={() => { setModal(true); setPwd(''); setPwdErr(false) }}>▶ Trigger Sync</Btn>}>
          <p className="text-[13px] text-muted">Triggers the <code className="text-steel">sync-prices.yml</code> GitHub Actions workflow on main.</p>
        </Panel>

        <Panel title="Sync History">
          {loading ? <Loading /> : runs.length ? (
            <Table heads={['Started', 'Duration', 'Status', 'Updated', 'Flagged', 'Skipped', 'Notes']}>
              {runs.map(r => (
                <tr key={r.id} className="hover:bg-white/2">
                  <Td>{fmt(r.started_at)}, {new Date(r.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Td>
                  <Td mono>{dur(r)}</Td>
                  <Td><Pill tone={statusTone[r.status] ?? 'muted'}>{r.status}</Pill></Td>
                  <Td mono>{r.rows_updated?.toLocaleString() ?? '—'}</Td>
                  <Td mono><span className={r.rows_flagged > 0 ? 'text-amber-400' : ''}>{r.rows_flagged ?? '—'}</span></Td>
                  <Td mono>{r.rows_skipped?.toLocaleString() ?? '—'}</Td>
                  <Td><span className="text-muted text-[11px] break-words">{r.error_message ?? ''}</span></Td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No sync runs yet. The sync script needs to write to sync_log.</EmptyState>}
        </Panel>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-7 w-96 max-w-[95vw]">
            <h3 className="text-[16px] font-bold text-heading mb-1">Confirm Sync Trigger</h3>
            <p className="text-[13px] text-muted mb-5">Enter the admin password to run sync-prices.yml on main.</p>
            <input
              type="password" placeholder="••••••••"
              value={pwd} onChange={e => setPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && triggerSync()}
              className="bg-surface border border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-accent w-full"
              autoFocus
            />
            {pwdErr && <p className="text-red-400 text-[12px] mt-2">Incorrect password.</p>}
            <div className="flex gap-2.5 justify-end mt-5">
              <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
              <Btn variant="warn" onClick={triggerSync} disabled={triggering}>
                {triggering ? 'Triggering…' : '▶ Run Sync'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
