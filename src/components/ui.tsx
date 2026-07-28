import { ReactNode } from 'react'

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-surface border-b border-border px-7 py-4">
      <h1 className="text-[15px] font-bold text-white">{title}</h1>
      {sub && <p className="text-[12px] text-sub mt-0.5">{sub}</p>}
    </div>
  )
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <span className="text-[13px] font-semibold text-white">{title}</span>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function StatCard({ label, value, sub, tone }: {
  label: string; value: string | number; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn'
}) {
  const col = tone === 'good' ? 'text-green' : tone === 'bad' ? 'text-red' : tone === 'warn' ? 'text-amber' : 'text-white'
  return (
    <div className="bg-elevated border border-border rounded-2xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-sub">{label}</p>
      <p className={`text-2xl font-bold mt-1.5 leading-none ${col}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-1.5">{sub}</p>}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">{children}</div>
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'green' | 'red' | 'warn' | 'blue' | 'muted' }) {
  const cls = {
    green: 'bg-green/15 text-green',
    red:   'bg-red/15 text-red',
    warn:  'bg-amber/15 text-amber',
    blue:  'bg-price/15 text-price',
    muted: 'bg-white/8 text-sub',
  }[tone]
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{children}</span>
}

export function GamePill({ game }: { game: string }) {
  const map: Record<string, string> = {
    pokemon:    'bg-orange-500/20 text-orange-400',
    mtg:        'bg-blue-500/20 text-blue-400',
    yugioh:     'bg-purple-500/20 text-purple-400',
    lorcana:    'bg-blue-600/20 text-blue-300',
    onepiece:   'bg-yellow-500/20 text-yellow-400',
    riftbound:  'bg-cyan-500/20 text-cyan-400',
    digimon:    'bg-pink-500/20 text-pink-400',
    dbsmasters: 'bg-orange-600/20 text-orange-300',
    dbsfusion:  'bg-red-500/20 text-red-400',
    swu:        'bg-slate-400/20 text-slate-300',
    sports:     'bg-emerald-500/20 text-emerald-400',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${map[game] ?? 'bg-white/10 text-sub'}`}>
      {game}
    </span>
  )
}

export function ConfidenceDot({ margin }: { margin: number | null }) {
  if (margin == null) return <span className="text-muted">—</span>
  if (margin >= 0.02) return <span className="text-green font-bold">{margin.toFixed(4)}</span>
  if (margin >= 0.005) return <span className="text-amber font-bold">{margin.toFixed(4)}</span>
  return <span className="text-red font-bold">{margin.toFixed(4)}</span>
}

export function Btn({
  children, onClick, variant = 'ghost', size = 'md', disabled,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'green' | 'warn'; size?: 'sm' | 'md'; disabled?: boolean
}) {
  const base = 'inline-flex items-center gap-1.5 font-semibold rounded-xl cursor-pointer border-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const sz   = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-[13px]'
  const v    = {
    primary: 'bg-green text-black hover:brightness-110',
    ghost:   'bg-transparent text-sub border border-border hover:bg-white/5 hover:text-white',
    danger:  'bg-red text-white hover:brightness-110',
    green:   'bg-green text-black hover:brightness-110',
    warn:    'bg-amber text-black hover:brightness-110',
  }[variant]
  return <button className={`${base} ${sz} ${v}`} onClick={onClick} disabled={disabled}>{children}</button>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-center py-12 text-sub text-[13px]">{children}</div>
}

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-border border-t-green rounded-full animate-spin" />
}

export function Loading() {
  return <div className="flex items-center gap-2.5 text-sub p-8 text-[13px]"><Spinner /> Loading…</div>
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted bg-elevated border-b border-border whitespace-nowrap">{children}</th>
}

export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-3 align-top border-b border-border/60 ${mono ? 'font-mono text-price text-[11.5px]' : 'text-[13px] text-white'}`}>{children}</td>
}

export function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead><tr>{heads.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-sub uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="bg-elevated border border-border text-white px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-green/50 w-full placeholder:text-muted" />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="bg-elevated border border-border text-white px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-green/50 w-full">
      {props.children}
    </select>
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="bg-elevated border border-border text-white px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-green/50 w-full resize-y min-h-[70px] placeholder:text-muted" />
}

export const eur = (v: number | null | undefined) => v != null ? `€${Number(v).toFixed(2)}` : '—'
export const ago = (d: string | null | undefined) => {
  if (!d) return '—'
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
export const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
