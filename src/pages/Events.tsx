import { useEffect, useState } from 'react'
import { sb, sbAdmin } from '../lib/supabase'
import { PageHeader, Panel, Table, Td, Pill, Btn, EmptyState, Loading, Field, Input, Select, Textarea, fmt } from '../components/ui'

type Event = {
  id: string; title: string; description: string | null; location_name: string | null
  lat: number; lng: number; event_date: string; event_type: string; url: string | null; created_at: string
}

const TYPE_TONE: Record<string, 'blue' | 'green' | 'muted' | 'warn'> = {
  tournament: 'blue', shop: 'green', trade: 'muted', release: 'warn', other: 'muted',
}

const blank = { title: '', location_name: '', description: '', lat: '', lng: '', event_date: '', event_type: 'tournament', url: '' }

export default function Events() {
  const [upcoming, setUpcoming] = useState<Event[]>([])
  const [past, setPast]         = useState<Event[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(blank)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')

  const today = new Date().toISOString().slice(0, 10)

  async function load() {
    setLoading(true)
    const [u, p] = await Promise.all([
      sb.from('radar_events').select('*').gte('event_date', today).order('event_date', { ascending: true }),
      sb.from('radar_events').select('*').lt('event_date', today).order('event_date', { ascending: false }).limit(20),
    ])
    setUpcoming(u.data ?? [])
    setPast(p.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!form.title || !form.event_date || !form.lat || !form.lng) {
      setMsg('Title, date, lat and lng are required.')
      return
    }
    setSaving(true)
    const { error } = await sbAdmin.from('radar_events').insert({
      title: form.title,
      location_name: form.location_name || null,
      description: form.description || null,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      event_date: form.event_date,
      event_type: form.event_type,
      url: form.url || null,
    })
    setSaving(false)
    if (error) { setMsg(error.message); return }
    setMsg('✓ Event added.')
    setForm(blank)
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this event?')) return
    await sbAdmin.from('radar_events').delete().eq('id', id)
    load()
  }

  const f = (k: string) => (e: any) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <>
      <PageHeader title="Events" sub="Manage Radar map events" />
      <div className="p-7">
        <Panel title="Add Event">
          <div className="grid grid-cols-2 gap-3.5 mb-3.5">
            <Field label="Title"><Input value={form.title} onChange={f('title')} placeholder="Sunday Tournament" /></Field>
            <Field label="Location Name"><Input value={form.location_name} onChange={f('location_name')} placeholder="Card Kingdom Amsterdam" /></Field>
          </div>
          <div className="mb-3.5">
            <Field label="Description"><Textarea value={form.description} onChange={f('description')} placeholder="Optional details…" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3.5 mb-3.5">
            <Field label="Latitude"><Input type="number" step="0.000001" value={form.lat} onChange={f('lat')} placeholder="52.370216" /></Field>
            <Field label="Longitude"><Input type="number" step="0.000001" value={form.lng} onChange={f('lng')} placeholder="4.895168" /></Field>
            <Field label="Date"><Input type="date" value={form.event_date} onChange={f('event_date')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3.5 mb-5">
            <Field label="Type">
              <Select value={form.event_type} onChange={f('event_type')}>
                <option value="tournament">Tournament</option>
                <option value="shop">Shop Event</option>
                <option value="trade">Trade Night</option>
                <option value="release">Release Day</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="URL (optional)"><Input type="url" value={form.url} onChange={f('url')} placeholder="https://…" /></Field>
          </div>
          <div className="flex items-center gap-3">
            <Btn variant="primary" onClick={add} disabled={saving}>{saving ? 'Saving…' : 'Add Event'}</Btn>
            {msg && <span className={`text-[12px] ${msg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</span>}
          </div>
        </Panel>

        <Panel title="Upcoming Events">
          {loading ? <Loading /> : upcoming.length ? (
            <Table heads={['Date', 'Title', 'Location', 'Type', 'URL', 'Actions']}>
              {upcoming.map(e => (
                <tr key={e.id} className="hover:bg-white/2">
                  <Td mono>{fmt(e.event_date)}</Td>
                  <Td><strong>{e.title}</strong></Td>
                  <Td>{e.location_name ?? '—'}</Td>
                  <Td><Pill tone={TYPE_TONE[e.event_type] ?? 'muted'}>{e.event_type}</Pill></Td>
                  <Td>{e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="text-steel text-[11px] hover:underline">Link ↗</a> : '—'}</Td>
                  <Td><Btn size="sm" variant="danger" onClick={() => del(e.id)}>Delete</Btn></Td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No upcoming events.</EmptyState>}
        </Panel>

        <Panel title="Past Events">
          {loading ? <Loading /> : past.length ? (
            <Table heads={['Date', 'Title', 'Location', 'Type']}>
              {past.map(e => (
                <tr key={e.id} className="hover:bg-white/2">
                  <Td mono>{fmt(e.event_date)}</Td>
                  <Td>{e.title}</Td>
                  <Td>{e.location_name ?? '—'}</Td>
                  <Td><Pill tone="muted">{e.event_type}</Pill></Td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No past events.</EmptyState>}
        </Panel>
      </div>
    </>
  )
}
