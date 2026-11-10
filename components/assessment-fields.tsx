import { CATEGORIES } from '@/lib/scoring'
import type { Opt } from '@/lib/options'
import { Field } from './ui'

export function AssessmentFields({ a, batches, trainers }: { a?: Record<string, unknown>; batches: Opt[]; trainers: Opt[] }) {
  const v = (k: string) => (a?.[k] == null ? '' : String(a[k]))
  const sel = new Set(((a?.batches as unknown[]) ?? []).map(String))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {a && <input type="hidden" name="id" value={v('_id')} />}
      <Field label="Assessment name *" className="sm:col-span-2"><input name="name" required defaultValue={v('name')} className="input" /></Field>
      <Field label="Category *"><select name="category" required defaultValue={v('category')} className="input"><option value="">Choose…</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Maximum marks *"><input name="maxMarks" type="number" min={1} required defaultValue={v('maxMarks') || '100'} className="input" /></Field>
      <Field label="Date *"><input name="date" type="date" required defaultValue={a?.date ? new Date(a.date as Date).toISOString().slice(0, 10) : ''} className="input" /></Field>
      <Field label="Duration (minutes)"><input name="durationMin" type="number" min={0} defaultValue={v('durationMin')} className="input" /></Field>
      <Field label="Trainer"><select name="trainer" defaultValue={v('trainer')} className="input"><option value="">Me</option>{trainers.map(([x, l]) => <option key={x} value={x}>{l}</option>)}</select></Field>
      <Field label="Status"><select name="status" defaultValue={v('status') || 'scheduled'} className="input"><option value="scheduled">Scheduled</option><option value="completed">Completed</option></select></Field>
      <Field label="Batches" hint="None selected = every active student. Ctrl/⌘-click for several." className="sm:col-span-2">
        <select name="batches" multiple defaultValue={[...sel]} className="input h-24">{batches.map(([x, l]) => <option key={x} value={x}>{l}</option>)}</select>
      </Field>
      <Field label="Remarks" className="sm:col-span-2"><textarea name="remarks" rows={2} defaultValue={v('remarks')} className="input" /></Field>
    </div>
  )
}
