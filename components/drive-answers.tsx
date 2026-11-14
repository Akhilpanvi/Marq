'use client'
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Download, FileText } from 'lucide-react'
import { loadDriveAnswers } from '@/app/actions/placement'
import { toast } from './toast'

type Row = { id: string; name: string; regNo: string; n: number }
type Data = { label: string; total: number; rows: Row[] }
type Opt = { id: string; label: string; archived: boolean; when: string }

/** "Who has answered the drives": pick Active / All / any set of drives (e.g. two old ones), see who answered them. */
export function DriveAnswers({ initial, options, canExport }: { initial: Data; options: Opt[]; canExport: boolean }) {
  const [data, setData] = useState(initial)
  const [mode, setMode] = useState<'active' | 'all' | 'pick'>('active')
  const [picked, setPicked] = useState<string[]>([])
  const [pending, start] = useTransition()
  const sel = mode === 'pick' ? picked.join(',') : mode
  const activeN = options.filter(o => !o.archived).length

  const load = (s: string) => start(async () => {
    try { setData(await loadDriveAnswers(s)) } catch { toast('Could not load those drives.', 'error') }
  })
  const choose = (m: 'active' | 'all' | 'pick') => {
    setMode(m)
    if (m !== 'pick') load(m)
  }
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))

  const groups = useMemo(() => {
    const t = data.total
    return {
      full: data.rows.filter(r => t > 0 && r.n >= t),
      partial: data.rows.filter(r => r.n > 0 && r.n < t).sort((a, b) => b.n - a.n),
      none: data.rows.filter(r => r.n === 0),
    }
  }, [data])

  const tab = (m: 'active' | 'all' | 'pick', label: string) => (
    <button type="button" aria-pressed={mode === m} onClick={() => choose(m)}
      className={`min-h-10 rounded-lg px-3 text-sm font-medium transition ${mode === m ? 'bg-accent-soft text-accent ring-1 ring-accent' : 'text-muted hover:bg-subtle hover:text-fg'}`}>{label}</button>
  )
  const panel = (title: string, xs: Row[], head: string, badge: string) => (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-subtle/40">
      <h3 className={`flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold ${head}`}><span>{title}</span><span className="rounded-full bg-black/10 px-2 py-0.5 text-xs tabular-nums dark:bg-white/10">{xs.length}</span></h3>
      <ul className="max-h-[50vh] space-y-2 overflow-y-auto p-3">
        {xs.map(r => (
          <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
            <div className="min-w-0">
              <Link href={`/students/${r.id}`} className="block text-sm leading-snug font-medium break-words hover:underline">{r.name}</Link>
              <div className="mt-0.5 font-mono text-xs text-muted">{r.regNo}</div>
            </div>
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badge}`}>{r.n}/{data.total}</span>
          </li>
        ))}
        {!xs.length && <li className="px-1 py-3 text-sm text-muted">None</li>}
      </ul>
    </section>
  )

  return (
    <div className="text-left text-sm leading-normal font-normal whitespace-normal text-fg" aria-busy={pending}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Which drives" className="flex flex-wrap gap-1 rounded-xl border border-line p-1">
          {tab('active', `Active drives (${activeN})`)}
          {tab('all', `All drives (${options.length})`)}
          {tab('pick', 'Choose drives…')}
        </div>
        {canExport && (
          <div className="ml-auto flex flex-wrap gap-2">
            <a className={`btn-outline ${mode === 'pick' && !picked.length ? 'pointer-events-none opacity-50' : ''}`} href={`/api/reports/driveAnswers?format=xlsx&drives=${encodeURIComponent(sel)}`}><Download className="size-4" />Excel</a>
            <a className={`btn-outline ${mode === 'pick' && !picked.length ? 'pointer-events-none opacity-50' : ''}`} href={`/reports/driveAnswers?print=1&drives=${encodeURIComponent(sel)}`} target="_blank" rel="noopener"><FileText className="size-4" />PDF</a>
          </div>
        )}
      </div>

      {mode === 'pick' && (
        <div className="mb-4 rounded-xl border border-line p-3">
          <p className="mb-2 text-xs text-muted">Tick the drives you want to check — active or archived — then press Show.</p>
          <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
            {options.map(o => (
              <label key={o.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-subtle">
                <input type="checkbox" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate" title={o.label}>{o.label}</span>
                {o.archived && <span className="shrink-0 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[11px] text-muted">Archived</span>}
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="btn-primary" disabled={!picked.length || pending} onClick={() => load(picked.join(','))}>{pending ? 'Loading…' : `Show ${picked.length || ''} drive${picked.length === 1 ? '' : 's'}`}</button>
            {picked.length > 0 && <button type="button" className="btn-ghost" onClick={() => setPicked([])}>Clear</button>}
          </div>
        </div>
      )}

      <p className="mb-4 text-sm text-muted"><b className="text-fg">{data.label}</b> · {data.total} drive{data.total === 1 ? '' : 's'}. A student has “answered” a drive when they set their status for it — “I didn’t apply” counts as an answer.</p>
      <div className={`grid gap-4 md:grid-cols-3 ${pending ? 'opacity-60' : ''}`}>
        {panel('All drives answered', groups.full, 'text-emerald-700 dark:text-emerald-300', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}
        {panel('Partly answered', groups.partial, 'text-amber-700 dark:text-amber-300', 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}
        {panel('Not answered yet', groups.none, 'text-red-700 dark:text-red-300', 'bg-red-500/15 text-red-700 dark:text-red-300')}
      </div>
    </div>
  )
}
