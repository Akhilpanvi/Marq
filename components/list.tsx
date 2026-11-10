import Link from 'next/link'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

export const PAGE_SIZE = 25
type SP = Record<string, string | string[] | undefined>
export const sp = (p: SP, k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '')
export const pageOf = (p: SP) => Math.max(1, Number(sp(p, 'page')) || 1)
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80)

/** Plain GET form: search + filters work without JavaScript and keep URLs shareable. */
export function Filters({ q = true, placeholder = 'Search…', children, params }: { q?: boolean; placeholder?: string; children?: React.ReactNode; params: SP }) {
  return (
    <form className="no-print flex flex-wrap items-center gap-2 border-b border-line p-3">
      {q && (
        <label className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
          <input name="q" defaultValue={sp(params, 'q')} placeholder={placeholder} className="input pl-9" />
        </label>
      )}
      {children}
      <button className="btn-outline">Apply</button>
    </form>
  )
}

export function Select({ name, value, options, all = 'All' }: { name: string; value?: string; options: (string | [string, string])[]; all?: string | false }) {
  return (
    <select name={name} defaultValue={value ?? ''} className="input w-auto" aria-label={name}>
      {all !== false && <option value="">{all}</option>}
      {options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o]
        return <option key={v} value={v}>{l}</option>
      })}
    </select>
  )
}

export function Pager({ page, total, params, path }: { page: number; total: number; params: SP; path: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (p: number) => {
    const u = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === 'string') as [string, string][])
    u.set('page', String(p))
    return `${path}?${u}`
  }
  return (
    <div className="no-print flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span>{total.toLocaleString('en-IN')} record{total === 1 ? '' : 's'} · page {page} of {pages}</span>
      <div className="flex gap-1">
        {page > 1 ? <Link className="btn-ghost px-2" href={href(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Link> : null}
        {page < pages ? <Link className="btn-ghost px-2" href={href(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Link> : null}
      </div>
    </div>
  )
}
