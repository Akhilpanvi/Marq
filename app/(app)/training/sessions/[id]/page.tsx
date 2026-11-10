import { notFound, redirect } from 'next/navigation'
import { ExternalLink, Trash2 } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { visibleBatches } from '@/lib/scope'
import { batchOptions, trainerOptions } from '@/lib/options'
import { day, ago } from '@/lib/format'
import { OID } from '@/lib/form'
import { Attendance, Batch, Student, TrainingSession, User } from '@/models'
import { Badge, Card, Empty, Field, KV, PageHeader } from '@/components/ui'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { MarkAll } from '@/components/client-bits'
import { Rating } from '@/components/rating'
import { addMaterial, deleteSession, markAttendance, removeMaterial, saveSession } from '@/app/actions/training'
import { SessionFields } from '@/components/session-fields'

const STATUSES = ['present', 'late', 'absent', 'excused'] as const

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage('training.view')
  const { id } = await params
  if (!OID.test(id)) notFound()
  const s = await TrainingSession.findById(id).lean()
  const scope = await visibleBatches(me)
  if (!s || (scope && !scope.some(b => String(b) === String(s.batch)))) notFound()
  if (s.register) redirect(`/attendance/register?day=${new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}`)
  const [batch, trainer, students, marks, bOpts, tOpts] = await Promise.all([
    Batch.findById(s.batch).lean(),
    s.trainer ? User.findById(s.trainer).select('name').lean() : null,
    Student.find({ batch: s.batch, status: { $ne: 'withdrawn' } }).select('name regNo').sort({ regNo: 1 }).lean(),
    Attendance.find({ session: s._id }).lean(),
    batchOptions(), trainerOptions(),
  ])
  const mark = new Map(marks.map(m => [String(m.student), m]))
  const counts = Object.fromEntries(STATUSES.map(k => [k, marks.filter(m => m.status === k).length]))
  const canMark = can(me, 'attendance.create') && (me.scope === 'all' || batch?.trainers.some(t => String(t) === String(me._id)))
  const canEdit = can(me, 'training.edit') && (me.scope === 'all' || batch?.trainers.some(t => String(t) === String(me._id)))
  const fb = s.feedback ?? []
  const avg = fb.length ? fb.reduce((a, f) => a + (f.rating ?? 0), 0) / fb.length : null
  const sName = new Map(students.map(x => [String(x._id), x.name]))

  return (
    <>
      <PageHeader back={{ href: '/training', label: 'Training' }} title={s.title} description={`${batch?.name ?? ''} · ${day(s.date)}${s.start ? ` · ${s.start}–${s.end ?? ''}` : ''}`}>
        {canEdit && (
          <Modal label="Edit session" title="Edit session" className="btn-outline" wide>
            <ActionForm action={saveSession} submit="Save" reset={false}><SessionFields s={s} batches={bOpts} trainers={tOpts} /></ActionForm>
          </Modal>
        )}
        {can(me, 'training.delete') && !marks.length && <ActionButton action={deleteSession} fields={{ id }} className="btn-ghost text-red-600" confirm="Delete this session?"><Trash2 className="size-4" /></ActionButton>}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Details">
            <KV items={[['Status', <Badge key="s" tone={s.status === 'completed' ? 'green' : 'amber'}>{s.status}</Badge>], ['Trainer', trainer?.name], ['Mode', s.mode], ['Venue', s.venue], ['Topics', s.topics.join(', ')], ['Batch', batch?.name]]} />
          </Card>
          <Card title="Learning materials">
            {s.materials.length ? (
              <ul className="space-y-2 text-sm">
                {s.materials.map(m => (
                  <li key={String(m._id)} className="flex items-center justify-between gap-2">
                    <a href={m.url ?? '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-accent hover:underline"><ExternalLink className="size-3.5" />{m.title}</a>
                    {canEdit && <ActionButton action={removeMaterial} fields={{ id, material: String(m._id) }} className="btn-ghost px-1.5 py-1 text-xs">Remove</ActionButton>}
                  </li>
                ))}
              </ul>
            ) : <Empty>No materials yet.</Empty>}
            {canEdit && (
              <ActionForm action={addMaterial} className="mt-4 space-y-2" submit="Add material">
                <input type="hidden" name="id" value={id} />
                <input name="title" required placeholder="Title" className="input" />
                <input name="url" type="url" required placeholder="https://…" className="input" />
              </ActionForm>
            )}
          </Card>
          <Card title={`Session feedback${avg != null ? ` · ${avg.toFixed(1)}/5` : ''}`}>
            {fb.length ? (
              <ul className="space-y-3 text-sm">{fb.map(f => <li key={String(f._id)}><div className="flex items-center justify-between"><span className="font-medium">{sName.get(String(f.student)) ?? 'Student'}</span><Rating value={f.rating ?? 0} /></div>{f.comment && <p className="text-muted">{f.comment}</p>}<p className="text-[11px] text-muted">{ago(f.at)}</p></li>)}</ul>
            ) : <Empty>Students can rate this session from their portal after attending.</Empty>}
          </Card>
        </div>

        <Card title={`Attendance · ${marks.length}/${students.length} marked`} className="lg:col-span-2" pad={false}
          action={<span className="text-xs text-muted">{STATUSES.map(k => `${counts[k]} ${k}`).join(' · ')}</span>}>
          {students.length ? (
            <ActionForm action={markAttendance} reset={false} className="space-y-0">
              <input type="hidden" name="session" value={id} />
              {canMark && <div className="flex flex-wrap gap-2 border-b border-line p-3"><MarkAll value="present" label="All present" /><MarkAll value="absent" label="All absent" /></div>}
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-subtle/60"><tr><th className="th">Student</th>{STATUSES.map(k => <th key={k} className="th text-center capitalize">{k}</th>)}<th className="th">History</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {students.map(st => {
                    const m = mark.get(String(st._id))
                    return (
                      <tr key={String(st._id)}>
                        <td className="td"><div className="font-medium">{st.name}</div><div className="font-mono text-xs text-muted">{st.regNo}</div></td>
                        {STATUSES.map(k => (
                          <td key={k} className="td text-center">
                            <input type="radio" name={`s_${st._id}`} value={k} defaultChecked={m?.status === k} disabled={!canMark} aria-label={`${st.name} ${k}`} className="size-4 accent-brand-600" />
                          </td>
                        ))}
                        <td className="td text-xs text-muted">{m?.history.map((h, i) => <div key={i}>{h.from}→{h.to}: {h.reason}</div>)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {canMark && (
                <div className="flex flex-wrap items-end gap-3 border-t border-line p-4">
                  <Field label="Reason (required when correcting a saved mark)" className="min-w-64 flex-1"><input name="reason" maxLength={300} className="input" /></Field>
                  <button className="btn-primary">Save attendance</button>
                </div>
              )}
            </ActionForm>
          ) : <div className="p-5"><Empty>No students are assigned to this batch.</Empty></div>}
        </Card>
      </div>
    </>
  )
}
