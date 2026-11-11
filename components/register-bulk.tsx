'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Files, ShieldCheck, Trash2, X } from 'lucide-react'
import { readRegisterFile, submitRegister } from '@/app/actions/register'
import type { Period } from '@/lib/periods'
import type { Parsed } from '@/lib/register-parse'
import { toast } from './toast'

type S = { id: string; regNo: string; name: string }
type Item = {
  key: string
  file: string
  day: string
  periods: Period[]
  absent: Record<string, number[]>
  read: number
  notes: string[]
  posted: boolean
  error?: string
  result?: 'saved' | string
}

const dmy = (d: string) => d.split('-').reverse().join('.')

/** Upload many register sheets at once: each file's date is read from the sheet (or its file name). */
export function RegisterBulk({ students, maxDay }: { students: S[]; maxDay: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [pending, start] = useTransition()
  const [progress, setProgress] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const byReg = new Map(students.map(s => [s.regNo, s]))
  const byId = new Map(students.map(s => [s.id, s]))

  const status = (it: Item, all: Item[]) => {
    if (it.result === 'saved') return { tone: 'ok', text: 'Saved & locked' } as const
    if (it.error) return { tone: 'bad', text: it.error } as const
    if (it.result) return { tone: 'bad', text: it.result } as const
    if (!it.day) return { tone: 'warn', text: 'No date found — pick it' } as const
    if (it.day > maxDay) return { tone: 'bad', text: 'Future date' } as const
    if (it.posted) return { tone: 'warn', text: 'Already posted — will be skipped' } as const
    if (all.filter(x => !x.error && x.day === it.day).length > 1) return { tone: 'bad', text: 'Same date as another file' } as const
    return { tone: 'ready', text: 'Ready' } as const
  }
  const ready = items.filter(it => status(it, items).tone === 'ready')

  function add(files: FileList) {
    const list = [...files]
    start(async () => {
      const out: Item[] = []
      for (const [i, f] of list.entries()) {
        setProgress(`Reading ${i + 1} of ${list.length}: ${f.name}`)
        const fd = new FormData()
        fd.set('file', f)
        const key = `${f.name}-${f.size}-${f.lastModified}`
        const r = await readRegisterFile(null, fd)
        if (r?.error || !r?.data) { out.push({ key, file: f.name, day: '', periods: [], absent: {}, read: 0, notes: [], posted: false, error: r?.error ?? 'Could not read' }); continue }
        const p = r.data as Parsed & { unknown: string[]; posted: boolean }
        const absent: Record<string, number[]> = {}
        for (const [reg, marks] of Object.entries(p.marks)) {
          const s = byReg.get(reg)
          const a = Object.entries(marks).filter(([, v]) => v === 'A').map(([k]) => Number(k))
          if (s && a.length) absent[s.id] = a
        }
        const notes = [...p.warnings.filter(w => !/No date found/.test(w))]
        if (p.unknown.length) notes.push(`${p.unknown.length} ID(s) not in MARQ were ignored`)
        const missing = students.filter(s => !(s.regNo in p.marks)).length
        if (missing) notes.push(`${missing} student(s) not in the sheet → present`)
        out.push({
          key, file: f.name, day: p.day ?? '', read: Object.keys(p.marks).length, absent, notes, posted: p.posted,
          periods: p.periods.map(x => ({ ...x, start: x.start || '09:00', end: x.end || '10:00' })),
        })
      }
      setProgress(null)
      setItems(cur => [...cur.filter(c => !out.some(o => o.key === c.key)), ...out].sort((a, b) => (a.day || '9').localeCompare(b.day || '9')))
    })
  }

  function confirmAll() {
    start(async () => {
      let saved = 0
      for (const [i, it] of ready.entries()) {
        setProgress(`Saving ${i + 1} of ${ready.length}: ${dmy(it.day)}`)
        const fd = new FormData()
        fd.set('payload', JSON.stringify({ day: it.day, periods: it.periods, absent: it.absent }))
        const r = await submitRegister(null, fd)
        if (!r?.error) saved++
        setItems(cur => cur.map(c => (c.key === it.key ? { ...c, result: r?.error ? r.error : 'saved' } : c)))
      }
      setProgress(null)
      dialog.current?.close()
      toast(`${saved} of ${ready.length} day${ready.length === 1 ? '' : 's'} saved and locked.`, saved === ready.length ? 'ok' : 'error')
      router.refresh()
    })
  }

  const absentees = (it: Item) => Object.keys(it.absent).length
  const tone = { ok: 'text-emerald-600', ready: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600' }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-outline cursor-pointer"><Files className="size-4" />{pending && progress ? 'Working…' : 'Choose Excel / CSV files'}
          <input type="file" multiple accept=".xlsx,.csv" className="sr-only" disabled={pending} onChange={e => { if (e.currentTarget.files?.length) add(e.currentTarget.files); e.currentTarget.value = '' }} />
        </label>
        {items.length > 0 && <button type="button" className="btn-ghost" disabled={pending} onClick={() => setItems([])}>Clear list</button>}
        <button type="button" className="btn-primary ml-auto" disabled={pending || !ready.length} onClick={() => dialog.current?.showModal()}><ShieldCheck className="size-4" />Verify {ready.length || ''} day{ready.length === 1 ? '' : 's'}</button>
        <p className="basis-full text-xs text-muted">Select several day sheets at once. Each file’s date is read from the sheet (or its file name, e.g. “Attendance 02.11.2026.xlsx”). Days already posted, future dates and two files for the same date are not saved.</p>
        {progress && <p className="basis-full text-sm text-muted" role="status">{progress}</p>}
      </div>

      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="stack w-full text-sm">
            <thead className="border-b border-line"><tr>{['File', 'Date', 'Students read', 'Absentees', 'Status', ''].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {items.map(it => {
                const st = status(it, items)
                return (
                  <tr key={it.key}>
                    <td data-label="File" className="td max-w-56 truncate" title={it.file}>{it.file}{it.notes.length > 0 && <div className="text-[11px] whitespace-normal text-muted">{it.notes.join(' · ')}</div>}</td>
                    <td data-label="Date" className="td">{it.error || it.result === 'saved' ? (it.day ? dmy(it.day) : '—') : (
                      <input type="date" value={it.day} max={maxDay} aria-label={`Date for ${it.file}`} className="input w-auto py-1"
                        onChange={e => { const day = e.target.value; setItems(cur => cur.map(c => (c.key === it.key ? { ...c, day, posted: false, result: undefined } : c))) }} />
                    )}</td>
                    <td data-label="Students read" className="td tabular-nums">{it.error ? '—' : it.read}</td>
                    <td data-label="Absentees" className="td tabular-nums">{it.error ? '—' : absentees(it)}</td>
                    <td data-label="Status" className={`td ${tone[st.tone]}`}>{st.text}</td>
                    <td className="td text-right">{it.result !== 'saved' && <button type="button" className="btn-ghost px-2" aria-label={`Remove ${it.file}`} onClick={() => setItems(cur => cur.filter(c => c.key !== it.key))}><Trash2 className="size-4" /></button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog ref={dialog} className="card m-auto w-[calc(100%-2rem)] max-w-2xl p-0 text-fg" onClick={e => e.target === dialog.current && dialog.current.close()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">Verify {ready.length} day{ready.length === 1 ? '' : 's'}</h2>
          <button type="button" className="btn-ghost px-2" aria-label="Close" onClick={() => dialog.current?.close()}><X className="size-4" /></button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {ready.map(it => (
            <div key={it.key}>
              <p className="text-sm font-medium">{dmy(it.day)} · {it.periods.length} periods · <span className="text-red-600">{absentees(it)} absentee{absentees(it) === 1 ? '' : 's'}</span></p>
              {absentees(it) ? (
                <ul className="mt-1 text-xs text-muted">{Object.entries(it.absent).map(([id, ps]) => { const s = byId.get(id); return <li key={id}><span className="font-mono">{s?.regNo}</span> {s?.name} — <span className="text-red-600">{ps.length === it.periods.length ? 'all periods' : `periods ${ps.join(', ')}`}</span></li> })}</ul>
              ) : <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="size-3.5" />Everyone present.</p>}
            </div>
          ))}
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">Confirming saves and locks each of these days. After that, changes need Director approval.</p>
          {progress && <p className="text-sm text-muted" role="status">{progress}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>Back</button>
          <button type="button" className="btn-primary" disabled={pending} onClick={confirmAll}>{pending ? 'Saving…' : `Confirm & lock ${ready.length} day${ready.length === 1 ? '' : 's'}`}</button>
        </div>
      </dialog>
    </div>
  )
}
