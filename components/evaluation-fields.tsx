import { Field } from './ui'

const R = ['technical', 'coding', 'communication', 'aptitude', 'attitude']

export function EvaluationFields({ student, students }: { student?: string; students?: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {student ? <input type="hidden" name="student" value={student} /> : (
        <Field label="Student *" className="sm:col-span-2">
          <select name="student" required className="input"><option value="">Choose…</option>{students?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
      )}
      <Field label="Date"><input name="date" type="date" className="input" /></Field>
      <div className="sm:col-span-2">
        <span className="label">Ratings (1–5)</span>
        <div className="grid grid-cols-5 gap-2">
          {R.map(k => (
            <label key={k} className="text-xs capitalize text-muted">{k}
              <select name={k} className="input mt-1 px-2"><option value="">—</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select>
            </label>
          ))}
        </div>
      </div>
      <Field label="Strengths" className="sm:col-span-2"><textarea name="strengths" rows={2} className="input" /></Field>
      <Field label="Weaknesses" className="sm:col-span-2"><textarea name="weaknesses" rows={2} className="input" /></Field>
      <Field label="Improvement recommendations" className="sm:col-span-2"><textarea name="recommendations" rows={2} className="input" /></Field>
      <Field label="Remarks" className="sm:col-span-2"><textarea name="remarks" rows={2} className="input" /></Field>
      <Field label="Follow-up date"><input name="followDate" type="date" className="input" /></Field>
      <Field label="Follow-up note"><input name="followNote" maxLength={500} className="input" /></Field>
    </div>
  )
}
