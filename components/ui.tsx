import { Children, cloneElement, isValidElement } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { initials } from '@/lib/format'
import { MarqMark } from './logo'

export function Card({ title, action, children, className = '', icon: Icon, pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; icon?: LucideIcon; pad?: boolean }) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {Icon && <Icon className="size-4 text-muted" />}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, description, children, back }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && <Link href={back.href} className="mb-2 inline-block text-xs font-medium text-muted hover:text-fg">← {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, icon: Icon, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        {label}
        {Icon && <Icon className="size-4" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </>
  )
  return href ? <Link href={href} className="card block p-4 transition hover:border-brand-300">{body}</Link> : <div className="card p-4">{body}</div>
}

export const Grid = ({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 | 6 }) => (
  <div className={`grid gap-4 grid-cols-2 ${{ 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 6: 'lg:grid-cols-6' }[cols]}`}>{children}</div>
)

const tones = {
  zinc: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 ring-zinc-500/20',
  brand: 'bg-brand-500/10 text-brand-700 dark:text-brand-300 ring-brand-500/20',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-500/25',
  red: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/20',
  blue: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/20',
}
export type Tone = keyof typeof tones

export function Badge({ children, tone = 'zinc' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}>{children}</span>
}

export function Empty({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      {Icon && <Icon className="size-5" />}
      {children}
    </div>
  )
}

export function Avatar({ name, src, size = 'size-9' }: { name: string; src?: string | null; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-line`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent ring-1 ring-line`}>{initials(name)}</span>
  )
}

export function Meter({ value, label, tone }: { value: number | null; label?: string; tone?: string }) {
  const v = value ?? 0
  const color = tone ?? (v >= 75 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-500' : 'bg-red-500')
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      {value != null && <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />}
    </div>
  )
}

/** A 0–100 score with colour; "—" when there is no data (never a fabricated zero). */
export function Score({ value, className = '' }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={`text-muted ${className}`} title="No data yet">—</span>
  const c = value >= 75 ? 'text-emerald-600 dark:text-emerald-400' : value >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  return <span className={`font-semibold tabular-nums ${c} ${className}`}>{Math.round(value)}</span>
}

export function Field({ label, children, hint, className = '' }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

/** Label every cell with its column heading so phones can show rows as stacked cards (see .stack in globals.css). */
function labelCells(children: React.ReactNode, head: React.ReactNode[]) {
  return Children.map(children, tr => {
    if (!isValidElement<{ children?: React.ReactNode }>(tr)) return tr
    let i = 0
    return cloneElement(tr, {}, Children.map(tr.props.children, td => {
      const label = head[i++]
      return isValidElement(td) && typeof label === 'string' ? cloneElement(td as React.ReactElement<{ 'data-label'?: string }>, { 'data-label': label }) : td
    }))
  })
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : []
  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead className="border-b border-line bg-subtle/60">
          <tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{labelCells(children, head)}</tbody>
      </table>
      {rows.length === 0 && <div className="p-4">{empty ?? <Empty>Nothing here yet.</Empty>}</div>}
    </div>
  )
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 truncate font-medium">{v || <span className="text-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-subtle ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <MarqMark className="size-7 animate-pulse" />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} />)}</div>
      <Skeleton className="h-72" />
    </div>
  )
}
