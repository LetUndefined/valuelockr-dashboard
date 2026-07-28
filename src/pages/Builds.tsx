import { useEffect, useState } from 'react'
import { GITHUB_TOKEN, GITHUB_REPO } from '../lib/supabase'
import { PageHeader, Panel, StatCard, StatGrid, Table, Td, Pill, Loading, EmptyState, ago } from '../components/ui'

type Run = {
  id: number; name: string; head_branch: string; status: string; conclusion: string | null
  run_started_at: string | null; updated_at: string; html_url: string
}

function dur(r: Run) {
  if (!r.updated_at || !r.run_started_at) return '—'
  const ms = new Date(r.updated_at).getTime() - new Date(r.run_started_at).getTime()
  return ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`
}

const statusTone = (r: Run): 'green' | 'red' | 'blue' | 'warn' | 'muted' =>
  r.conclusion === 'success' ? 'green' : r.conclusion === 'failure' ? 'red' :
  r.status === 'in_progress' ? 'blue' : r.conclusion === 'cancelled' ? 'muted' : 'muted'

export default function Builds() {
  const [runs, setRuns]     = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!GITHUB_TOKEN) { setLoading(false); return }
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?per_page=30`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
    })
      .then(r => r.json())
      .then(d => { setRuns(d.workflow_runs ?? []); setLoading(false) })
      .catch(() => { setError('GitHub API request failed.'); setLoading(false) })
  }, [])

  if (!GITHUB_TOKEN) return (
    <>
      <PageHeader title="Builds" sub="GitHub Actions workflow runs" />
      <div className="p-7"><EmptyState>Set VITE_GITHUB_TOKEN in your .env to load build data.</EmptyState></div>
    </>
  )

  const finished = runs.filter(r => r.conclusion)
  const successRate = finished.length ? finished.filter(r => r.conclusion === 'success').length / finished.length : null

  return (
    <>
      <PageHeader title="Builds" sub="GitHub Actions workflow runs" />
      <div className="p-7">
        {loading ? <Loading /> : error ? <EmptyState>{error}</EmptyState> : (
          <>
            <StatGrid>
              <StatCard label="Runs (shown)" value={runs.length} />
              <StatCard label="Success Rate" value={successRate != null ? `${(successRate * 100).toFixed(0)}%` : '—'} tone={successRate != null ? (successRate > 0.9 ? 'good' : 'warn') : undefined} />
              <StatCard label="Last Run" value={ago(runs[0]?.updated_at)} />
            </StatGrid>

            <Panel title="Recent Runs">
              {runs.length ? (
                <Table heads={['Workflow', 'Branch', 'Status', 'Started', 'Duration', 'Link']}>
                  {runs.map(r => (
                    <tr key={r.id} className="hover:bg-white/2">
                      <Td>{r.name}</Td>
                      <Td mono>{r.head_branch}</Td>
                      <Td><Pill tone={statusTone(r)}>{r.conclusion ?? r.status}</Pill></Td>
                      <Td><span className="text-muted">{ago(r.run_started_at)}</span></Td>
                      <Td mono>{dur(r)}</Td>
                      <Td><a href={r.html_url} target="_blank" rel="noreferrer" className="text-steel text-[11px] hover:underline">View ↗</a></Td>
                    </tr>
                  ))}
                </Table>
              ) : <EmptyState>No runs found.</EmptyState>}
            </Panel>
          </>
        )}
      </div>
    </>
  )
}
