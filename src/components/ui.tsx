import { ReactNode } from 'react'

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="sticky top-0 z-10 bg-surface border-b border-border px-7 py-4">
      <h1 className="text-[16px] font-bold text-heading">{title}</h1>
      {sub && <p className="text-[12px] text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <span className="text-[13px] font-bold text-heading">{title}</span>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'good' | 'bad' | 'warn' }) {
  const col = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-heading'
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 leading-none ${col}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-1">{sub}</p>}
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">{children}</div>
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'green' | 'red' | 'warn' | 'blue' | 'muted' }) {
  const cls = {
    green: 'bg-emerald-400/15 text-emerald-400',
    red:   'bg-red-400/15 text-red-400',
    warn:  'bg-amber-400/15 text-amber-400',
    blue:  'bg-accent/15 text-accent',
    muted: 'bg-white/7 text-muted',
  }[tone]
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold ${cls}`}>{children}</span>
}

export function Btn({
  children, onClick, variant = 'ghost', size = 'md', disabled,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'green' | 'warn'; size?: 'sm' | 'md'; disabled?: boolean
}) {
  const base = 'inline-flex items-center gap-1.5 font-semibold rounded-lg cursor-pointer border-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const sz   = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[12.5px]'
  const v    = {
    primary: 'bg-accent text-white hover:brightness-110',
    ghost:   'bg-transparent text-text border border-border hover:bg-white/6',
    danger:  'bg-red-500 text-white hover:brightness-110',
    green:   'bg-emerald-600 text-white hover:brightness-110',
    warn:    'bg-amber-600 text-white hover:brightness-110',
  }[variant]
  return <button className={`${base} ${sz} ${v}`} onClick={onClick} disabled={disabled}>{children}</button>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-center py-10 text-muted text-[13px]">{children}</div>
}

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
}

export function Loading() {
  return <div className="flex items-center gap-2.5 text-muted p-8"><Spinner /> Loading…</div>
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted bg-white/4 border-b border-border whitespace-nowrap">{children}</th>
}

export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2.5 text-[12.5px] align-top border-b border-white/4 ${mono ? 'font-mono text-steel text-[11.5px]' : 'text-text'}`}>{children}</td>
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
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="bg-surface border border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-accent w-full" />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className="bg-surface border border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-accent w-full">
      {props.children}
    </select>
  )
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="bg-surface border border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-accent w-full resize-y min-h-[70px]" />
}

export const eur  = (v: number | null | undefined) => v != null ? `€${Number(v).toFixed(2)}` : '—'
export const ago  = (d: string | null | undefined) => {
  if (!d) return '—'
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
export const fmt  = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
