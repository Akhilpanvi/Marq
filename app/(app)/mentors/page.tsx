import Link from 'next/link'
import { Plus } from 'lucide-react'
import { can, requirePage, studentScope } from '@/lib/auth'
import { profiles } from '@/lib/intel'
import { mentorOptions } from '@/lib/options'
import { day } from '@/lib/format'
import { Evaluation, Student, User } from '@/models'
import { Badge, Card, Empty, Field, Grid, PageHeader, Score, Stat, Table } from '@/components/ui'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { EvaluationFields } from '@/components/evaluation-fields'
import { EvaluationList } from '@/components/evaluation-list'
import { Pager, PAGE_SIZE, pageOf } from '@/components/list'
import { allocateMentor, closeFollowUp, saveEvaluation } from '@/app/actions/mentorship'

export const metadata = { title: 'Mentorship' }

export default async function MentorsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('mentorship.view')
  const params = await searchParams
  const page = pageOf(params)
  const scope = await studentScope(me)
  const students = await Student.find({ ...scope, status: { $nin: ['withdrawn', 'dropped'] } }).select('name regNo mentor').sort({ regNo: 1 }).lean()
  const ids = students.map(s => s._id)
  const evalFilter = me.scope === 'all' ? {} : { student: { $in: ids } }
  const [prof, evals, totalEvals, followUps, mentors, lastEval] = await Promise.all([
    profiles(ids),
    Evaluation.find(evalFilter).sort({ date: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Evaluation.countDocuments(evalFilter),
    Evaluation.find({ ...evalFilter, 'followUp.date': { $ne: null }, 'followUp.done': false }).sort({ 'followUp.date': 1 }).limit(30).lean(),
    mentorOptions(),
    Evaluation.aggregate<{ _id: unknown; at: Date; n: number }>([{ $match: { student: { $in: ids } } }, { $group: { _id: '$student', at: { $max: '$date' }, n: { $sum: 1 } } }]),
  ])
  const evaluators = await User.find({ _id: { $in: evals.map(e => e.mentor) } }).select('name').lean()
  const mName = new Map([...mentors, ...evaluators.map(u => [String(u._id), u.name] as [string, string])])
  const sName = new Map(students.map(s => [String(s._id), s]))
  const last = new Map(lastEval.map(l => [String(l._id), l]))
  const studentOpts: [string, string][] = students.map(s => [String(s._id), `${s.name} (${s.regNo})`])
  const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const byMentor = mentors.map(([id, name]) => {
    const mine = students.filter(s => String(s.mentor) === id)
    return { id, name, n: mine.length, overall: avg(mine.map(s => prof.get(String(s._id))?.overall ?? null)), evals: mine.reduce((t, s) => t + (last.get(String(s._id))?.n ?? 0), 0), attention: mine.filter(s => prof.get(String(s._id))?.flags.attention).length }
  })
  const unassigned = students.filter(s => !s.mentor).length

  return (
    <>
      <PageHeader title={me.scope === 'assigned' ? 'Student Evaluations' : 'Mentorship'} description="Mentor allocation, evaluations, feedback history and follow-ups.">
        {me.scope === 'all' && can(me, 'students.edit') && (
          <Modal label="Allocate mentor" title="Allocate mentor" className="btn-outline" wide>
            <ActionForm action={allocateMentor} submit="Assign">
              <Field label="Mentor"><select name="mentor" required className="input"><option value="">Choose…</option>{mentors.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Students" hint="Ctrl/⌘-click to choose several."><select name="ids" multiple required className="input h-64">{students.map(s => <option key={String(s._id)} value={String(s._id)}>{s.name} ({s.regNo}){s.mentor ? ` — ${mName.get(String(s.mentor)) ?? ''}` : ''}</option>)}</select></Field>
            </ActionForm>
          </Modal>
        )}
        {can(me, 'mentorship.create') && (
          <Modal label={<><Plus className="size-4" />Add evaluation</>} title="Add evaluation" wide>
            <ActionForm action={saveEvaluation} submit="Save evaluation"><EvaluationFields students={studentOpts} /></ActionForm>
          </Modal>
        )}
      </PageHeader>

      <Grid>
        <Stat label={me.scope === 'all' ? 'Students' : 'My students'} value={students.length} hint={me.scope === 'all' ? `${unassigned} without a mentor` : undefined} />
        <Stat label="Evaluations" value={totalEvals} />
        <Stat label="Open follow-ups" value={followUps.length} />
        <Stat label="Never evaluated" value={students.filter(s => !last.has(String(s._id))).length} />
      </Grid>

      {me.scope === 'all' && (
        <Card title="Mentor-wise progress" className="mt-6" pad={false}>
          <Table head={['Mentor', 'Students', 'Average overall', 'Evaluations', 'Needs attention']} empty={<Empty>No mentor accounts yet. Create users with the Mentor role.</Empty>}>
            {byMentor.map(m => <tr key={m.id}><td className="td font-medium">{m.name}</td><td className="td tabular-nums">{m.n}</td><td className="td"><Score value={m.overall} /></td><td className="td tabular-nums">{m.evals}</td><td className="td">{m.attention ? <Badge tone="amber">{m.attention}</Badge> : '0'}</td></tr>)}
          </Table>
        </Card>
      )}

      {me.scope === 'assigned' && (
        <Card title="My mentees" className="mt-6" pad={false}>
          <Table head={['Student', 'Overall', 'Readiness', 'Last evaluated', 'Flags']} empty={<Empty>No students are assigned to you yet.</Empty>}>
            {students.map(s => {
              const p = prof.get(String(s._id))
              const l = last.get(String(s._id))
              return <tr key={String(s._id)}><td className="td"><Link className="font-medium hover:underline" href={`/students/${s._id}`}>{s.name}</Link><div className="font-mono text-xs text-muted">{s.regNo}</div></td><td className="td"><Score value={p?.overall} /></td><td className="td"><Score value={p?.readiness} /></td><td className="td text-muted">{l ? `${day(l.at)} (${l.n})` : 'never'}</td><td className="td">{p?.flags.attention && <Badge tone="amber">Needs attention</Badge>}{p?.flags.declining && <Badge tone="red">Declining</Badge>}</td></tr>
            })}
          </Table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Open follow-ups">
          {followUps.length ? (
            <ul className="space-y-3 text-sm">
              {followUps.map(f => (
                <li key={String(f._id)} className="flex items-start justify-between gap-2">
                  <div><Link href={`/students/${f.student}`} className="font-medium hover:underline">{sName.get(String(f.student))?.name}</Link><div className={`text-xs ${f.followUp!.date! < new Date() ? 'text-red-600' : 'text-muted'}`}>{day(f.followUp!.date)} · {f.followUp!.note}</div></div>
                  {can(me, 'mentorship.edit') && <ActionButton action={closeFollowUp} fields={{ id: String(f._id) }} className="btn-ghost px-2 py-1 text-xs">Done</ActionButton>}
                </li>
              ))}
            </ul>
          ) : <Empty>No open follow-ups.</Empty>}
        </Card>
        <Card title="Feedback history" className="lg:col-span-2" pad={false}>
          <div className="p-5"><EvaluationList items={evals} mentorName={mName} studentName={new Map(students.map(s => [String(s._id), s.name]))} /></div>
          <Pager page={page} total={totalEvals} params={params} path="/mentors" />
        </Card>
      </div>
    </>
  )
}
