import { useEffect, useState } from 'react'
import { sb, sbAdmin } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Pill, Btn, EmptyState, Loading, ago } from '../components/ui'

type FeedbackRow = {
  id: string; message: string; category: string; game: string | null
  card_name: string | null; card_number: string | null; set_name: string | null
  screen: string | null; platform: string | null; screenshot_url: string | null
  created_at: string; resolved_at: string | null; notes: string | null
}

const catTone: Record<string, 'warn' | 'red' | 'blue' | 'muted'> = {
  bug: 'red', price_issue: 'warn', f1_beta: 'blue', general: 'muted',
}

export default function Feedback() {
  const [open, setOpen] = useState<FeedbackRow[]>([])
  const [resolved, setResolved] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [o, r] = await Promise.all([
      sb.from('feedback').select('*').is('resolved_at', null).order('created_at', { ascending: false }).limit(200),
      sb.from('feedback').select('*').not('resolved_at', 'is', null).gte('resolved_at', since).order('resolved_at', { ascending: false }).limit(100),
    ])
    setOpen(o.data ?? [])
    setResolved(r.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resolve(f: FeedbackRow) {
    await sbAdmin.from('feedback').update({ resolved_at: new Date().toISOString() }).eq('id', f.id)
    load()
  }

  const renderRow = (f: FeedbackRow, showAction: boolean) => (
    <tr key={f.id} className="hover:bg-white/2">
      <Td><Pill tone={catTone[f.category] ?? 'muted'}>{f.category.replace('_', ' ')}</Pill></Td>
      <Td>
        <p className="max-w-[420px] whitespace-pre-wrap">{f.message}</p>
        {(f.card_name || f.game) && (
          <p className="text-[11px] text-muted mt-1">
            {[f.game, f.card_name, f.set_name, f.card_number ? `#${f.card_number}` : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </Td>
      <Td>{f.screen ?? '—'}</Td>
      <Td>
        {f.screenshot_url ? (
          <img
            src={f.screenshot_url}
            alt="screenshot"
            className="w-10 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80"
            onClick={() => setZoomUrl(f.screenshot_url)}
          />
        ) : '—'}
      </Td>
      <Td>{f.platform ?? '—'}</Td>
      <Td><span className="text-muted">{ago(f.created_at)}</span></Td>
      {showAction && <Td><Btn size="sm" variant="green" onClick={() => resolve(f)}>✓ Resolve</Btn></Td>}
    </tr>
  )

  return (
    <>
      <PageHeader title="Feedback" sub="User-submitted reports, with auto-captured screenshots" />
      <div className="p-7">
        <Panel title="Open" action={<Pill tone={open.length ? 'warn' : 'green'}>{open.length} open</Pill>}>
          {loading ? <Loading /> : open.length ? (
            <Table heads={['Category', 'Message', 'Screen', 'Screenshot', 'Platform', 'Received', 'Actions']}>
              {open.map((f) => renderRow(f, true))}
            </Table>
          ) : <EmptyState>No open feedback 🎉</EmptyState>}
        </Panel>

        <Panel title="Resolved (last 30 days)">
          {loading ? <Loading /> : resolved.length ? (
            <Table heads={['Category', 'Message', 'Screen', 'Screenshot', 'Platform', 'Received']}>
              {resolved.map((f) => renderRow(f, false))}
            </Table>
          ) : <EmptyState>Nothing resolved yet.</EmptyState>}
        </Panel>
      </div>

      {zoomUrl && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-8" onClick={() => setZoomUrl(null)}>
          <img src={zoomUrl} alt="screenshot" className="max-h-full max-w-full rounded-xl border border-border" />
        </div>
      )}
    </>
  )
}
