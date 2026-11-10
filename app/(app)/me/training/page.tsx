import { ExternalLink } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { day } from '@/lib/format'
import { Attendance, Batch, Program, Student, TrainingSession, User } from '@/models'
import { Badge, Card, Empty, Meter, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/form'
import { sessionFeedback } from '@/app/actions/me'

export const metadata = { title: 'My Training' }

export default async function MyTraining() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('batch').lean()
  if (!s?.batch) return <><PageHeader title="My Training" /><Empty>You have not been assigned to a batch yet.</Empty></>
  const [batch, sessions, att] = await Promise.all([
    Batch.findById(s.batch).lean(),
    TrainingSession.find({ batch: s.batch, status: { $ne: 'cancelled' } }).sort({ date: -1 }).lean(),
    Attendance.find({ student: me.student }).select('session status').lean(),
  ])
  const [program, trainers] = await Promise.all([batch ? Program.findById(batch.program).select('name').lean() : null, User.find({ _id: { $in: sessions.flatMap(x => (x.trainer ? [x.trainer] : [])) } }).select('name').lean()])
  const tName = new Map(trainers.map(t => [String(t._id), t.name]))
  const status = new Map(att.map(a => [String(a.session), a.status]))
  const done = sessions.filter(x => x.status === 'completed').length
  return (
    <>
      <PageHeader title="My Training" description={`${program?.name ?? ''} · ${batch?.name ?? ''}`} />
      <div className="card mb-6 p-4"><div className="mb-2 flex justify-between text-sm"><span>Training progress</span><span className="text-muted">{done} of {sessions.length} sessions completed</span></div><Meter value={sessions.length ? (done / sessions.length) * 100 : 0} tone="bg-[var(--color-c1)]" label="Training progress" /></div>
      <div className="space-y-4">
        {sessions.map(x => {
          const st = status.get(String(x._id))
          const mine = x.feedback.find(f => String(f.student) === String(me.student))
          return (
            <Card key={String(x._id)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{x.title}</div>
                  <div className="text-sm text-muted">{day(x.date)}{x.start ? ` · ${x.start}–${x.end ?? ''}` : ''} · {x.mode}{x.venue ? ` · ${x.venue}` : ''} · {tName.get(String(x.trainer)) ?? ''}</div>
                  {x.topics.length > 0 && <div className="mt-1 text-xs text-muted">Topics: {x.topics.join(', ')}</div>}
                </div>
                <div className="flex gap-1.5"><Badge tone={x.status === 'completed' ? 'green' : 'amber'}>{x.status}</Badge>{st && <Badge tone={st === 'present' ? 'green' : st === 'absent' ? 'red' : 'zinc'}>{st}</Badge>}</div>
              </div>
              {x.materials.length > 0 && <ul className="mt-3 flex flex-wrap gap-3 text-sm">{x.materials.map(m => <li key={String(m._id)}><a href={m.url ?? '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline"><ExternalLink className="size-3.5" />{m.title}</a></li>)}</ul>}
              {(st === 'present' || st === 'late') && (
                <ActionForm action={sessionFeedback} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4" reset={false}>
                  <input type="hidden" name="session" value={String(x._id)} />
                  <label className="text-sm">Rate this session <select name="rating" defaultValue={mine?.rating ?? ''} required className="input mt-1 w-auto"><option value="">—</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}</select></label>
                  <input name="comment" defaultValue={mine?.comment ?? ''} placeholder="Comment (optional)" className="input min-w-48 flex-1" />
                  <button className="btn-outline">{mine ? 'Update feedback' : 'Send feedback'}</button>
                </ActionForm>
              )}
            </Card>
          )
        })}
        {!sessions.length && <Empty>No sessions scheduled yet.</Empty>}
      </div>
    </>
  )
}
