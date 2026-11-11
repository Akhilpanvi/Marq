import { Field, Badge, Empty } from './ui'
import { ActionForm } from './form'
import { dayTime, isoDay } from '@/lib/format'
import { statusTone } from '@/lib/placement'
import { saveApplication, setApplicationStatus } from '@/app/actions/placement'
import type { Opt } from '@/lib/options'

type App = { _id?: unknown; company?: string; role?: string; link?: string | null; appliedOn?: Date | null; source?: string | null; status?: string; remarks?: string | null; job?: unknown; docs?: { title?: string | null; url?: string | null }[] }

export function ApplicationFields({ a, statuses, students }: { a?: App; statuses: readonly string[]; students?: Opt[] }) {
  const locked = !!a?.job
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {a?._id ? <input type="hidden" name="id" value={String(a._id)} /> : null}
      {students && !a && <Field label="Student *" className="sm:col-span-2"><select name="student" required className="input"><option value="">Choose…</option>{students.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
      <Field label="Company name *"><input name="company" required defaultValue={a?.company} readOnly={locked} className="input" /></Field>
      <Field label="Job role *"><input name="role" required defaultValue={a?.role} readOnly={locked} className="input" /></Field>
      <Field label="Application link"><input name="link" type="url" defaultValue={a?.link ?? ''} className="input" /></Field>
      <Field label="Date applied"><input name="appliedOn" type="date" defaultValue={isoDay(a?.appliedOn)} className="input" /></Field>
      <Field label="Source"><input name="source" defaultValue={a?.source ?? 'Self'} className="input" placeholder="LinkedIn, referral, campus…" list="sources" /></Field>
      <datalist id="sources">{['Self', 'LinkedIn', 'Company website', 'Referral', 'Naukri', 'Campus drive', 'MARQ'].map(s => <option key={s} value={s} />)}</datalist>
      {!a && <Field label="Current status"><select name="status" defaultValue="Applied" className="input">{statuses.map(s => <option key={s}>{s}</option>)}</select></Field>}
      <Field label="Remarks" className="sm:col-span-2"><textarea name="remarks" rows={2} defaultValue={a?.remarks ?? ''} className="input" /></Field>
      <div className="sm:col-span-2">
        <span className="label">Supporting documents (links, optional)</span>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
              <input name={`docTitle${i}`} defaultValue={a?.docs?.[i - 1]?.title ?? ''} placeholder="Resume, offer letter…" className="input" />
              <input name={`docUrl${i}`} type="url" defaultValue={a?.docs?.[i - 1]?.url ?? ''} placeholder="https://drive.google.com/…" className="input" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StatusForm({ id, current, statuses, student }: { id: string; current: string; statuses: readonly string[]; student?: string }) {
  return (
    <ActionForm action={setApplicationStatus} className="flex flex-wrap items-end gap-2" reset={false}>
      <input type="hidden" name="id" value={id} />
      {student && <input type="hidden" name="student" value={student} />}
      <select name="status" defaultValue={current} className="input w-auto" aria-label="New status">{statuses.map(s => <option key={s}>{s}</option>)}</select>
      <input name="remarks" placeholder="Remarks (optional)" className="input min-w-40 flex-1" />
      <button className="btn-primary">Update</button>
    </ActionForm>
  )
}

type H = { from?: string | null; to?: string | null; byName?: string | null; at?: Date | null; remarks?: string | null }
export function AppTimeline({ history }: { history: H[] }) {
  if (!history.length) return <Empty>No history.</Empty>
  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {history.map((h, i) => (
        <li key={i} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-accent" />
          <div className="flex flex-wrap items-center gap-1.5 text-sm">{h.from && <><Badge tone={statusTone(h.from)}>{h.from}</Badge>→</>}<Badge tone={statusTone(h.to ?? '')}>{h.to}</Badge></div>
          <div className="text-xs text-muted">{dayTime(h.at)} · {h.byName ?? 'system'}</div>
          {h.remarks && <p className="text-sm">{h.remarks}</p>}
        </li>
      ))}
    </ol>
  )
}


export function ApplicationForm({ a, statuses, students, submit = 'Save application' }: { a?: App; statuses: readonly string[]; students?: Opt[]; submit?: string }) {
  return <ActionForm action={saveApplication} submit={submit} reset={!a}><ApplicationFields a={a} statuses={statuses} students={students} /></ActionForm>
}

