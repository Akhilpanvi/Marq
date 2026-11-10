import { Field } from './ui'
import type { Opt } from '@/lib/options'

export function SessionFields({ s, batches, trainers }: { s?: Record<string, unknown>; batches: Opt[]; trainers: Opt[] }) {
  const v = (k: string) => (s?.[k] == null ? '' : String(s[k]))
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {s && <input type="hidden" name="id" value={v('_id')} />}
      <Field label="Title *" className="sm:col-span-2"><input name="title" required defaultValue={v('title')} className="input" /></Field>
      <Field label="Batch *"><select name="batch" required defaultValue={v('batch')} className="input"><option value="">Choose…</option>{batches.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
      <Field label="Trainer"><select name="trainer" defaultValue={v('trainer')} className="input"><option value="">Me</option>{trainers.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
      <Field label="Date *"><input name="date" type="date" required defaultValue={s?.date ? new Date(s.date as Date).toISOString().slice(0, 10) : ''} className="input" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start"><input name="start" type="time" defaultValue={v('start')} className="input" /></Field>
        <Field label="End"><input name="end" type="time" defaultValue={v('end')} className="input" /></Field>
      </div>
      <Field label="Mode"><select name="mode" defaultValue={v('mode') || 'Offline'} className="input"><option>Offline</option><option>Online</option></select></Field>
      <Field label="Venue / link"><input name="venue" defaultValue={v('venue')} className="input" /></Field>
      <Field label="Topics" hint="Comma separated" className="sm:col-span-2"><input name="topics" defaultValue={((s?.topics as string[]) ?? []).join(', ')} className="input" /></Field>
      <Field label="Status"><select name="status" defaultValue={v('status') || 'scheduled'} className="input"><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field>
    </div>
  )
}
