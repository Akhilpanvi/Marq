'use client'
import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileSpreadsheet, ShieldCheck, X } from 'lucide-react'
import { readRegisterFile, submitRegister } from '@/app/actions/register'
import { columns, DEFAULT_PERIODS, span, type Period } from '@/lib/periods'
import type { Parsed } from '@/lib/register-parse'
import { toast } from './toast'

type S = { id: string; regNo: string; name: string; department: string; specialization: string }

/** Post a day's register: upload or tick, Verify (absentee pop-up), Confirm (saved and locked). */
export function RegisterEditor({ students, initialDay, maxDay, batch, batchName }: { students: S[]; initialDay: string; maxDay: string; batch: string; batchName: string }) {
  const router = useRouter()
  const [day, setDay] = useState(initialDay)
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS)
  const [absent, setAbsent] = useState<Record<string, number[]>>({})
  const [q, setQ] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const cols = useMemo(() => columns(periods), [periods])
  const byReg = useMemo(() => new Map(students.map(s => [s.regNo, s.id])), [students])
  const shown = q ? students.filter(s => `${s.regNo} ${s.name}`.toLowerCase().includes(q.toLowerCase())) : students
  const absentees = students.filter(s => absent[s.id]?.length)
  const total = absentees.reduce((t, s) => t + absent[s.id].length, 0)

  const toggle = (id: string, no: number) => setAbsent(a => {
    const cur = new Set(a[id] ?? [])
    cur.has(no) ? cur.delete(no) : cur.add(no)
    return { ...a, [id]: [...cur].sort((x, y) => x - y) }
  })
  const rowAbsent = (id: string, on: boolean) => setAbsent(a => ({ ...a, [id]: on ? periods.map(p => p.no) : [] }))

  function upload(file: File) {
    const fd = new FormData()
    fd.set('file', file)
    fd.set('batch', batch)
    start(async () => {
      const r = await readRegisterFile(null, fd)
      if (r?.error) return void toast(r.error, 'error')
      const p = r!.data as Parsed & { unknown: string[] }
      if (p.day) setDay(p.day > maxDay ? maxDay : p.day)
      setPeriods(p.periods.map(x => ({ ...x, start: x.start || '09:00', end: x.end || '10:00' })))
      const next: Record<string, number[]> = {}
      for (const [reg, marks] of Object.entries(p.marks)) {
        const id = byReg.get(reg)
        if (id) next[id] = Object.entries(marks).filter(([, v]) => v === 'A').map(([k]) => Number(k))
      }
      setAbsent(next)
      const msgs = [r!.ok, ...p.warnings]
      if (p.unknown.length) msgs.push(`${p.unknown.length} ID(s) in the sheet are not in batch ${batchName} and were ignored: ${p.unknown.slice(0, 5).join(', ')}${p.unknown.length > 5 ? '…' : ''}`)
      if (p.blanks) msgs.push(`${p.blanks} blank cell(s) were taken as present.`)
      const missing = students.filter(s => !(s.regNo in p.marks)).length
      if (missing) msgs.push(`${missing} student(s) of batch ${batchName} were not in the sheet and are marked present.`)
      setNote(msgs.join(' '))
      toast(r!.ok!)
    })
  }

  function confirm() {
    const fd = new FormData()
    fd.set('payload', JSON.stringify({ day, batch, periods, absent: Object.fromEntries(Object.entries(absent).filter(([, v]) => v.length)) }))
    start(async () => {
      const r = await submitRegister(null, fd)
      if (r?.error) return void toast(r.error, 'error')
      dialog.current?.close()
      toast(r!.ok!)
      router.replace(`/attendance/register?day=${day}&batch=${batch}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm"><span className="label">Date</span><input type="date" value={day} max={maxDay} onChange={e => setDay(e.target.value)} className="input w-auto" /></label>
        <label className="btn-outline cursor-pointer"><FileSpreadsheet className="size-4" />{pending ? 'Reading…' : 'Upload Excel / CSV'}
          <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={e => e.currentTarget.files?.[0] && upload(e.currentTarget.files[0])} />
        </label>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ID or name" className="input w-full sm:w-56" />
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setAbsent({})}>All present</button>
          <button type="button" className="btn-primary" disabled={pending} onClick={() => dialog.current?.showModal()}><ShieldCheck className="size-4" />Verify</button>
        </div>
        <p className="basis-full text-xs text-muted">Everyone starts as Present. Tap a cell to mark A. Uploading the college sheet fills the date, periods and marks automatically; nothing is saved until you Verify and Confirm.</p>
        {note && <p className="basis-full rounded-lg bg-subtle px-3 py-2 text-sm">{note}</p>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm md:min-w-[900px]">
          <thead className="border-b border-line">
            <tr className="bg-subtle/70">
              {['Sl No.', 'Student ID NO', 'Parent Branch', 'Branch', 'Student Name'].map((h, i) => <th key={h} rowSpan={2} className={`th border-r border-line ${i === 0 || i === 2 || i === 3 ? 'hidden md:table-cell' : ''}`}>{h}</th>)}
              {cols.map((c, i) => <th key={i} className="th text-center">{c.kind === 'period' ? c.p.no : ''}</th>)}
              <th rowSpan={2} className="th text-center">Row</th>
            </tr>
            <tr className="bg-subtle/70">{cols.map((c, i) => <th key={i} className="px-2 pb-2 text-center text-[11px] font-normal text-muted">{c.kind === 'period' ? span(c.p) : span(c)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map(s => {
              const ab = new Set(absent[s.id] ?? [])
              return (
                <tr key={s.id}>
                  <td className="td hidden tabular-nums text-muted md:table-cell">{students.indexOf(s) + 1}</td>
                  <td className="td font-mono text-xs">{s.regNo}</td>
                  <td className="td hidden md:table-cell">{s.department}</td>
                  <td className="td hidden md:table-cell">{s.specialization}</td>
                  <td className="td">{s.name}</td>
                  {cols.map((c, i) => c.kind === 'break' ? <td key={i} className="td text-center text-xs text-muted">Lunch Break</td> : (
                    <td key={i} className="td p-1 text-center">
                      <button type="button" onClick={() => toggle(s.id, c.p.no)} aria-pressed={ab.has(c.p.no)} aria-label={`${s.name} period ${c.p.no} ${ab.has(c.p.no) ? 'absent' : 'present'}`}
                        className={`h-8 w-full min-w-10 rounded-md text-xs font-semibold transition ${ab.has(c.p.no) ? 'bg-red-500/15 text-red-700 ring-1 ring-red-500/40 dark:text-red-300' : 'text-muted hover:bg-subtle'}`}>
                        {ab.has(c.p.no) ? 'A' : 'P'}
                      </button>
                    </td>
                  ))}
                  <td className="td text-center"><button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => rowAbsent(s.id, ab.size !== periods.length)}>{ab.size === periods.length ? 'Clear' : 'All A'}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} className="card m-auto w-[calc(100%-2rem)] max-w-2xl p-0 text-fg" onClick={e => e.target === dialog.current && dialog.current.close()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">Verify attendance · {batchName} · {day.split('-').reverse().join('.')}</h2>
          <button type="button" className="btn-ghost px-2" aria-label="Close" onClick={() => dialog.current?.close()}><X className="size-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          <p className="mb-3 text-sm">{students.length} students · {periods.length} periods · <b className="text-red-600">{absentees.length} absentee{absentees.length === 1 ? '' : 's'}</b> ({total} absent period{total === 1 ? '' : 's'})</p>
          {absentees.length ? (
            <table className="w-full text-sm">
              <thead className="border-b border-line"><tr><th className="th">Student ID</th><th className="th">Name</th><th className="th">Absent periods</th></tr></thead>
              <tbody className="divide-y divide-line">{absentees.map(s => <tr key={s.id}><td className="td font-mono text-xs">{s.regNo}</td><td className="td">{s.name}</td><td className="td text-red-600">{absent[s.id].length === periods.length ? 'All periods' : absent[s.id].join(', ')}</td></tr>)}</tbody>
            </table>
          ) : <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="size-4" />Everyone is present for every period.</p>}
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">Confirming saves and locks this day. After that, changes need Director approval.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>Back</button>
          <button type="button" className="btn-primary" disabled={pending} onClick={confirm}>{pending ? 'Saving…' : 'Confirm & lock'}</button>
        </div>
      </dialog>
    </div>
  )
}
