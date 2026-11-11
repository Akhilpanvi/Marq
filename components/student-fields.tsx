import { Field } from './ui'
import type { Opt } from '@/lib/options'

type S = { _id?: unknown; regNo?: string; name?: string; email?: string; personalEmail?: string | null; phone?: string | null; department?: string | null; specialization?: string | null; year?: string | null; section?: string | null; photoUrl?: string | null; batch?: unknown; mentor?: unknown; status?: string | null }

export function StudentFields({ s = {}, batches, mentors }: { s?: S; batches: Opt[]; mentors: Opt[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {s._id ? <input type="hidden" name="id" value={String(s._id)} /> : null}
      <Field label="Registration number *"><input name="regNo" required maxLength={20} defaultValue={s.regNo} className="input uppercase" /></Field>
      <Field label="Full name *"><input name="name" required maxLength={120} defaultValue={s.name} className="input" /></Field>
      <Field label="University email *"><input name="email" type="email" required defaultValue={s.email} className="input" /></Field>
      <Field label="Placement mail ID"><input name="personalEmail" type="email" defaultValue={s.personalEmail ?? ''} className="input" /></Field>
      <Field label="Mobile number"><input name="phone" type="tel" maxLength={20} defaultValue={s.phone ?? ''} className="input" /></Field>
      <Field label="Department"><input name="department" maxLength={80} defaultValue={s.department ?? ''} className="input" placeholder="CSE" /></Field>
      <Field label="Specialization"><input name="specialization" maxLength={80} defaultValue={s.specialization ?? ''} className="input" /></Field>
      <Field label="Academic year"><input name="year" maxLength={20} defaultValue={s.year ?? ''} className="input" placeholder="2026–27 / III" /></Field>
      <Field label="Section"><input name="section" maxLength={20} defaultValue={s.section ?? ''} className="input" /></Field>
      <Field label="Assigned batch">
        <select name="batch" defaultValue={s.batch ? String(s.batch) : ''} className="input"><option value="">—</option>{batches.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Assigned mentor">
        <select name="mentor" defaultValue={s.mentor ? String(s.mentor) : ''} className="input"><option value="">—</option>{mentors.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Cohort status">
        <select name="status" defaultValue={s.status ?? 'active'} className="input">
          {[['active', 'Active'], ['on_hold', 'On hold'], ['withdrawn', 'Withdrawn'], ['completed', 'Completed']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Profile picture link" hint="Google Drive share link (Anyone with the link can view). Leave blank to use the GitHub profile picture." className="sm:col-span-2"><input name="photoUrl" type="url" placeholder="https://drive.google.com/file/d/…/view" defaultValue={s.photoUrl ?? ''} className="input" /></Field>
    </div>
  )
}

export const STATUS_LABEL: Record<string, string> = { active: 'Active', on_hold: 'On hold', withdrawn: 'Withdrawn', completed: 'Completed' }
