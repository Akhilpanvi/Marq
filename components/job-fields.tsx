import { Field } from './ui'
import { isoDay } from '@/lib/format'
import type { Opt } from '@/lib/options'

export function JobFields({ j, companies }: { j?: Record<string, unknown>; companies: Opt[] }) {
  const v = (k: string) => (j?.[k] == null ? '' : String(j[k]))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {j && <input type="hidden" name="id" value={v('_id')} />}
      <Field label="Company *"><select name="company" required defaultValue={v('company')} className="input"><option value="">Choose…</option>{companies.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
      <Field label="Job role *"><input name="role" required defaultValue={v('role')} className="input" /></Field>
      <Field label="Salary package (LPA)"><input name="ctc" type="number" step="0.01" min={0} defaultValue={v('ctc')} className="input" /></Field>
      <Field label="Package details"><input name="ctcText" defaultValue={v('ctcText')} placeholder="12 LPA + joining bonus" className="input" /></Field>
      <Field label="Job location"><input name="location" defaultValue={v('location')} className="input" /></Field>
      <Field label="Job type"><select name="type" defaultValue={v('type') || 'Full-time'} className="input">{['Full-time', 'Internship', 'Internship + Full-time', 'Contract'].map(t => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Application deadline"><input name="deadline" type="date" defaultValue={isoDay(j?.deadline as Date)} className="input" /></Field>
      <Field label="Application link"><input name="link" type="url" defaultValue={v('link')} className="input" /></Field>
      <Field label="Required skills" hint="Comma separated" className="sm:col-span-2"><input name="skills" defaultValue={((j?.skills as string[]) ?? []).join(', ')} className="input" /></Field>
      <Field label="Eligibility criteria" className="sm:col-span-2"><textarea name="eligibility" rows={2} defaultValue={v('eligibility')} className="input" /></Field>
      <Field label="Job description" className="sm:col-span-2"><textarea name="description" rows={4} defaultValue={v('description')} className="input" /></Field>
      <Field label="Recruitment process" className="sm:col-span-2"><textarea name="process" rows={2} defaultValue={v('process')} placeholder="Online test → Technical → HR" className="input" /></Field>
      <Field label="Visibility"><select name="status" defaultValue={v('status') || 'open'} className="input"><option value="open">Published (open)</option><option value="draft">Draft</option><option value="closed">Closed</option></select></Field>
    </div>
  )
}
