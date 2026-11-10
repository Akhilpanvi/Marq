import Link from 'next/link'
import { Plus } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { visibleBatches } from '@/lib/scope'
import { batchOptions, programOptions, trainerOptions } from '@/lib/options'
import { day, pct } from '@/lib/format'
import { Attendance, Batch, Program, Student, TrainingSession, User } from '@/models'
import { Badge, Card, Field, Meter, PageHeader, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp } from '@/components/list'
import { ActionForm, Modal } from '@/components/form'
import { saveBatch, saveProgram, saveSession } from '@/app/actions/training'
import { SessionFields } from '@/components/session-fields'

export const metadata = { title: 'Training' }

export default async function TrainingPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('training.view')
  const params = await searchParams
  const page = pageOf(params)
  const scope = await visibleBatches(me)
  const batchFilter = scope ? { _id: { $in: scope } } : {}
  const sessFilter: Record<string, unknown> = scope ? { batch: { $in: scope } } : {}
  const batch = sp(params, 'batch'), status = sp(params, 'status')
  if (batch) sessFilter.batch = scope && !scope.some(b => String(b) === batch) ? null : batch
  if (status) sessFilter.status = status

  const [sessions, total, batches, programs, bOpts, pOpts, tOpts, users] = await Promise.all([
    TrainingSession.find(sessFilter).select('-feedback').sort({ date: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    TrainingSession.countDocuments(sessFilter),
    Batch.find(batchFilter).sort({ name: 1 }).lean(),
    Program.find().sort({ createdAt: -1 }).lean(),
    batchOptions(), programOptions(), trainerOptions(),
    User.find({ type: { $in: ['trainer', 'faculty', 'mentor', 'administrative'] } }).select('name').lean(),
  ])
  const uName = new Map(users.map(u => [String(u._id), u.name]))
  const bName = new Map(batches.map(b => [String(b._id), b.name]))
  const visibleOpts = scope ? bOpts.filter(([id]) => scope.some(b => String(b) === id)) : bOpts

  // progress per batch: sessions done / total, average attendance, students
  const ids = batches.map(b => b._id)
  const [sessAgg, attAgg, stuAgg] = await Promise.all([
    TrainingSession.aggregate<{ _id: { b: unknown; s: string }; n: number }>([{ $match: { batch: { $in: ids } } }, { $group: { _id: { b: '$batch', s: '$status' }, n: { $sum: 1 } } }]),
    Attendance.aggregate<{ _id: unknown; att: number; counted: number }>([
      { $lookup: { from: 'trainingsessions', localField: 'session', foreignField: '_id', as: 's' } }, { $unwind: '$s' }, { $match: { 's.batch': { $in: ids }, status: { $ne: 'excused' } } },
      { $group: { _id: '$s.batch', att: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }, counted: { $sum: 1 } } },
    ]),
    Student.aggregate<{ _id: unknown; n: number }>([{ $match: { batch: { $in: ids } } }, { $group: { _id: '$batch', n: { $sum: 1 } } }]),
  ])
  const prog = (b: unknown) => {
    const rows = sessAgg.filter(r => String(r._id.b) === String(b))
    const done = rows.find(r => r._id.s === 'completed')?.n ?? 0
    const all = rows.filter(r => r._id.s !== 'cancelled').reduce((s, r) => s + r.n, 0)
    const a = attAgg.find(r => String(r._id) === String(b))
    return { done, all, att: a?.counted ? (a.att / a.counted) * 100 : null, students: stuAgg.find(r => String(r._id) === String(b))?.n ?? 0 }
  }
  const canCreate = can(me, 'training.create')

  return (
    <>
      <PageHeader title={me.scope === 'assigned' ? 'Training Progress' : 'Training'} description="Programmes, batches, trainer allocation, schedules and session materials.">
        {canCreate && me.scope === 'all' && (
          <Modal label="New programme" title="New programme" className="btn-outline">
            <ActionForm action={saveProgram} submit="Create programme">
              <Field label="Name *"><input name="name" required className="input" placeholder="Top Notch Marquee Training 2026" /></Field>
              <Field label="Description"><textarea name="description" rows={3} className="input" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Start"><input name="startDate" type="date" className="input" /></Field><Field label="End"><input name="endDate" type="date" className="input" /></Field></div>
            </ActionForm>
          </Modal>
        )}
        {canCreate && me.scope === 'all' && (
          <Modal label="New batch" title="New batch" className="btn-outline">
            <ActionForm action={saveBatch} submit="Create batch">
              <Field label="Programme *"><select name="program" required className="input"><option value="">Choose…</option>{pOpts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
              <Field label="Batch name *"><input name="name" required className="input" placeholder="Batch A" /></Field>
              <Field label="Trainers" hint="Ctrl/⌘-click to choose several."><select name="trainers" multiple className="input h-28">{tOpts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Start"><input name="startDate" type="date" className="input" /></Field><Field label="End"><input name="endDate" type="date" className="input" /></Field></div>
            </ActionForm>
          </Modal>
        )}
        {canCreate && (
          <Modal label={<><Plus className="size-4" />Schedule session</>} title="Schedule session" wide>
            <ActionForm action={saveSession} submit="Schedule"><SessionFields batches={visibleOpts} trainers={tOpts} /></ActionForm>
          </Modal>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {batches.map(b => {
          const p = prog(b._id)
          return (
            <div key={String(b._id)} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{b.name}</div><div className="text-xs text-muted">{programs.find(x => String(x._id) === String(b.program))?.name} · {p.students} students</div></div>
                <Badge tone="blue">{p.all ? Math.round((p.done / p.all) * 100) : 0}% done</Badge>
              </div>
              <div className="mt-3"><Meter value={p.all ? (p.done / p.all) * 100 : 0} tone="bg-[var(--color-c1)]" label="Sessions completed" /></div>
              <div className="mt-2 flex justify-between text-xs text-muted"><span>{p.done}/{p.all} sessions</span><span>Attendance {pct(p.att)}</span></div>
              <div className="mt-2 truncate text-xs text-muted">Trainers: {b.trainers.map(t => uName.get(String(t))).filter(Boolean).join(', ') || '—'}</div>
            </div>
          )
        })}
        {!batches.length && <p className="text-sm text-muted">No batches yet{canCreate && me.scope === 'all' ? ' — create a programme, then a batch.' : '.'}</p>}
      </div>

      <Card title="Sessions" pad={false}>
        <Filters params={params} q={false}>
          <Select name="batch" value={batch} options={visibleOpts} all="All batches" />
          <Select name="status" value={status} options={[['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]} all="All statuses" />
        </Filters>
        <Table head={['Session', 'Batch', 'Date', 'Trainer', 'Mode', 'Status']}>
          {sessions.map(s => (
            <tr key={String(s._id)} className="hover:bg-subtle/50">
              <td className="td"><Link href={`/training/sessions/${s._id}`} className="font-medium hover:underline">{s.title}</Link>{s.topics.length > 0 && <div className="truncate text-xs text-muted">{s.topics.join(', ')}</div>}</td>
              <td className="td">{bName.get(String(s.batch)) ?? '—'}</td>
              <td className="td text-muted">{day(s.date)}{s.start ? ` · ${s.start}` : ''}</td>
              <td className="td">{uName.get(String(s.trainer)) ?? '—'}</td>
              <td className="td text-muted">{s.mode}</td>
              <td className="td"><Badge tone={s.status === 'completed' ? 'green' : s.status === 'cancelled' ? 'zinc' : 'amber'}>{s.status}</Badge></td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/training" />
      </Card>
    </>
  )
}
