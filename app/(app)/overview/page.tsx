import Link from 'next/link'
import { AlertTriangle, CalendarClock, ClipboardCheck, GraduationCap, Trophy, Upload, UserPlus, Users } from 'lucide-react'
import { can, requireUser, scopedStudentIds, studentScope } from '@/lib/auth'
import { profiles } from '@/lib/intel'
import { appMetrics } from '@/lib/app-metrics'
import { visibleBatches } from '@/lib/scope'
import { ago, day, pct } from '@/lib/format'
import { Application, Assessment, AuditLog, Batch, Company, Job, Student, TrainingSession, User, Attendance } from '@/models'
import { Badge, Card, Empty, Grid, PageHeader, Score, Stat, Table } from '@/components/ui'
import { Bars } from '@/components/charts'
import { AttendanceDays } from '@/components/attendance-days'
import { OFFERED } from '@/lib/placement'
import { MarqWordmark } from '@/components/logo'

export const metadata = { title: 'Overview' }
const fmt0 = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('en-IN'))
function SectionTitle({ n, title, href }: { n: number; title: string; href: string }) {
  return <div className="mb-3 flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{n}</span><h2 className="font-semibold">{title}</h2><Link href={href} className="ml-auto text-xs text-accent hover:underline">Details →</Link></div>
}
const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }

export default async function Overview() {
  const me = await requireUser()
  if (me.student) return null

  const scope = await studentScope(me)
  const ids = await scopedStudentIds(me)
  const sMatch = ids ? { student: { $in: ids } } : {}
  const batchScope = await visibleBatches(me)
  const [students, prof, m, attDaily, catAvg, conducted, upcomingSessions, batches, recent, placed, answered] = await Promise.all([
    can(me, 'students.view') ? Student.find(scope).select('name regNo status batch').lean() : [],
    can(me, 'performance.view') ? profiles(ids) : new Map(),
    can(me, 'applications.view') ? appMetrics(sMatch) : null,
    can(me, 'attendance.view')
      ? Attendance.aggregate<{ _id: string; att: number; counted: number }>([{ $match: { ...sMatch, status: { $ne: 'excused' } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } }, att: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }, counted: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      : [],
    can(me, 'assessments.view') ? Assessment.aggregate<{ _id: string; avg: number }>([{ $lookup: { from: 'assessmentresults', localField: '_id', foreignField: 'assessment', as: 'r' } }, { $unwind: '$r' }, { $match: { 'r.marks': { $ne: null }, ...(ids ? { 'r.student': { $in: ids } } : {}) } }, { $group: { _id: '$category', avg: { $avg: { $multiply: [{ $divide: ['$r.marks', '$maxMarks'] }, 100] } } } }, { $sort: { avg: -1 } }]) : [],
    can(me, 'assessments.view') ? Assessment.countDocuments({ status: 'completed', ...(batchScope ? { batches: { $in: batchScope } } : {}) }) : 0,
    can(me, 'training.view') ? TrainingSession.find({ status: 'scheduled', date: { $gte: new Date(Date.now() - 12 * 3600_000) }, ...(batchScope ? { batch: { $in: batchScope } } : {}) }).select('title date start batch').sort({ date: 1 }).limit(6).lean() : [],
    Batch.find(batchScope ? { _id: { $in: batchScope } } : {}).select('name').lean(),
    can(me, 'audit.view') ? AuditLog.find().sort({ at: -1 }).limit(8).lean() : [],
    can(me, 'applications.view') ? Application.distinct('student', { ...sMatch, status: { $in: OFFERED } }) : [],
    can(me, 'applications.view') ? Application.distinct('student', { ...sMatch, job: { $ne: null } }) : [],
  ])

  // students restricted to those whose profiles we hold (scope already applied)
  const rows = students.map(s => ({ s, p: prof.get(String(s._id)) })).filter(r => r.p)
  const withScore = rows.filter(r => r.p!.overall != null)
  const top = [...withScore].sort((a, b) => b.p!.overall! - a.p!.overall!).slice(0, 5)
  const attention = rows.filter(r => r.p!.flags.attention || r.p!.flags.declining).sort((a, b) => (a.p!.overall ?? 0) - (b.p!.overall ?? 0)).slice(0, 6)
  const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}–${i * 10 + 10}`, students: 0 }))
  withScore.forEach(r => bins[Math.min(9, Math.floor(r.p!.overall! / 10))].students++)
  const att = attDaily.reduce((a, r) => ({ att: a.att + r.att, counted: a.counted + r.counted }), { att: 0, counted: 0 })
  const bName = new Map(batches.map(b => [String(b._id), b.name]))
  const active = students.filter(s => s.status === 'active').length
  const linked = rows.filter(r => r.p!.codingPoints != null || r.p!.githubPoints != null)
  const coders = rows.filter(r => r.p!.codingPoints != null).sort((a, b) => (b.p!.codingPoints ?? 0) - (a.p!.codingPoints ?? 0))
  const codeBins = Array.from({ length: 5 }, (_, i) => ({ range: `${i * 20}–${i * 20 + 20}`, students: 0 }))
  rows.forEach(r => r.p!.dims.coding != null && codeBins[Math.min(4, Math.floor(r.p!.dims.coding / 20))].students++)
  const lowAtt = rows.filter(r => r.p!.dims.attendance != null && r.p!.dims.attendance < 75).sort((a, b) => a.p!.dims.attendance! - b.p!.dims.attendance!)
  const dayTiles = attDaily.map(d => ({ day: d._id, attended: d.att, held: d.counted, note: 'periods', href: `/attendance/register?day=${d._id}` }))
  const director = me.roleKey === 'director'
  const assistant = can(me, 'users.create') && can(me, 'students.create') && !can(me, 'training.create')

  return (
    <>
      <PageHeader
        title={director ? 'Executive Overview' : me.scope === 'assigned' ? `Welcome, ${me.name.split(' ')[0]}` : 'Programme Overview'}
        description={<span className="flex items-center gap-2"><MarqWordmark className="h-3 w-auto" /> Top Notch Marquee Training Programme · {me.roleName}</span>}
      />

      {m && (
        <section>
          <SectionTitle n={1} title="Placement" href="/placement" />
          <Grid>
            <Stat label="Students placed" value={placed.length} hint={`of ${active} active students`} icon={Trophy} href="/placement" />
            <Stat label="Offers" value={m.offers} hint={`${m.accepted} accepted`} />
            <Stat label="Applications" value={m.total} hint={`${m.companies} companies`} href="/applications" />
            <Stat label="Answered drive status" value={`${answered.length}/${active}`} hint="students who updated at least one drive" />
          </Grid>
          <Card title="Placement progress" className="mt-4">
            <Bars data={[{ s: 'Applied', n: m.total }, { s: 'Online test', n: m.written }, { s: 'Technical round', n: m.technical }, { s: 'HR round', n: m.hr }, { s: 'Offers', n: m.offers }, { s: 'Accepted', n: m.accepted }]} x="s" series={[{ key: 'n', label: 'Applications' }]} height={200} />
            {director && <DirectorExtras />}
          </Card>
        </section>
      )}

      {can(me, 'performance.view') && (
        <section className="mt-8">
          <SectionTitle n={2} title="Coding scores" href="/reports/coding" />
          <Grid>
            <Stat label="Coding profiles linked" value={`${linked.length}/${rows.length}`} icon={GraduationCap} />
            <Stat label="Average coding points" value={fmt0(mean(coders.map(r => r.p!.codingPoints ?? null)))} />
            <Stat label="Average coding score" value={<Score value={mean(rows.map(r => r.p!.dims.coding))} />} hint="out of 100" />
            <Stat label="Average GitHub score" value={<Score value={mean(rows.map(r => r.p!.dims.github))} />} hint="out of 100" />
          </Grid>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <Card title="Top coders" icon={Trophy} pad={false}>
              <Table head={['#', 'Student', 'Coding points', 'Score']} empty={<Empty>Appears once students link coding profiles.</Empty>}>
                {coders.slice(0, 8).map((r, i) => <tr key={String(r.s._id)}><td className="td tabular-nums text-muted">{i + 1}</td><td className="td"><Link href={`/students/${r.s._id}`} className="font-medium hover:underline">{r.s.name}</Link></td><td className="td tabular-nums">{fmt0(r.p!.codingPoints)}</td><td className="td"><Score value={r.p!.dims.coding} /></td></tr>)}
              </Table>
            </Card>
            <Card title="Coding score spread"><Bars data={codeBins} x="range" series={[{ key: 'students', label: 'Students' }]} height={220} /></Card>
          </div>
        </section>
      )}

      {can(me, 'attendance.view') && (
        <section className="mt-8">
          <SectionTitle n={3} title="Attendance" href="/attendance" />
          <Grid>
            <Stat label="Average attendance" value={pct(att.counted ? (att.att / att.counted) * 100 : null)} icon={CalendarClock} />
            <Stat label="Below 75%" value={lowAtt.length} hint="students" />
            <Stat label="Days recorded" value={attDaily.length} />
            <Stat label="Assessments conducted" value={conducted} icon={ClipboardCheck} />
          </Grid>
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <Card title="Day-wise attendance" className="lg:col-span-2"><AttendanceDays days={dayTiles} limit={14} /></Card>
            <Card title="Below 75%" icon={AlertTriangle} pad={false}>
              <Table head={['Student', 'Attendance']} empty={<Empty>Everyone is at 75% or above.</Empty>}>
                {lowAtt.slice(0, 8).map(r => <tr key={String(r.s._id)}><td className="td"><Link href={`/students/${r.s._id}`} className="font-medium hover:underline">{r.s.name}</Link></td><td className="td"><Score value={r.p!.dims.attendance} /></td></tr>)}
              </Table>
            </Card>
          </div>
        </section>
      )}

      {assistant && <AssistantPanel scope={scope} />}

      <h2 className="mt-10 mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Overall performance</h2>
      <Grid>
        <Stat label={me.scope === 'assigned' ? 'My students' : 'Total students'} value={students.length} icon={Users} href={can(me, 'students.view') ? '/students' : undefined} />
        <Stat label="Active students" value={active} />
        <Stat label="Average overall score" value={<Score value={mean(rows.map(r => r.p!.overall))} />} hint={`${withScore.length} with scores`} />
      </Grid>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Overall score distribution"><Bars data={bins} x="range" series={[{ key: 'students', label: 'Students' }]} height={220} /></Card>
        <Card title="Assessment performance by category"><Bars data={catAvg.map(c => ({ category: c._id, avg: Math.round(c.avg * 10) / 10 }))} x="category" series={[{ key: 'avg', label: 'Average %' }]} domain={[0, 100]} horizontal height={Math.max(180, catAvg.length * 32)} /></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Top performing students" icon={Trophy} pad={false}>
          <Table head={['Student', 'Overall']} empty={<Empty>Scores appear once results are recorded.</Empty>}>
            {top.map(r => <tr key={String(r.s._id)}><td className="td"><Link href={`/students/${r.s._id}`} className="font-medium hover:underline">{r.s.name}</Link></td><td className="td"><Score value={r.p!.overall} /></td></tr>)}
          </Table>
        </Card>
        <Card title="Students requiring attention" icon={AlertTriangle} pad={false}>
          <Table head={['Student', 'Overall', 'Why']} empty={<Empty>No one is flagged.</Empty>}>
            {attention.map(r => <tr key={String(r.s._id)}><td className="td"><Link href={`/students/${r.s._id}`} className="font-medium hover:underline">{r.s.name}</Link></td><td className="td"><Score value={r.p!.overall} /></td><td className="td">{r.p!.flags.declining ? <Badge tone="red">Declining</Badge> : <Badge tone="amber">{r.p!.dims.attendance != null && r.p!.dims.attendance < 75 ? 'Attendance' : 'Low score'}</Badge>}</td></tr>)}
          </Table>
        </Card>
        <Card title="Coming up" icon={CalendarClock}>
          <ul className="space-y-3 text-sm">
            {upcomingSessions.map(s => <li key={String(s._id)}><Link href={`/training/sessions/${s._id}`} className="font-medium hover:underline">{s.title}</Link><div className="text-xs text-muted">Session · {bName.get(String(s.batch))} · {day(s.date)}{s.start ? ` ${s.start}` : ''}</div></li>)}
            {!upcomingSessions.length && <li className="text-muted">Nothing scheduled.</li>}
          </ul>
        </Card>
      </div>

      {recent.length > 0 && (
        <Card title="Recent activity" className="mt-6">
          <ul className="divide-y divide-line text-sm">{recent.map(r => <li key={String(r._id)} className="flex justify-between gap-4 py-2"><span><b>{r.actorName}</b> <span className="text-muted">·</span> {r.action} <span className="text-muted">({r.module})</span></span><span className="text-xs whitespace-nowrap text-muted">{ago(r.at)}</span></li>)}</ul>
        </Card>
      )}
    </>
  )
}

async function DirectorExtras() {
  const [companies, open] = await Promise.all([Company.countDocuments(), Job.countDocuments({ status: 'open' })])
  return <p className="mt-3 text-sm text-muted">{companies} companies participating · {open} open drives</p>
}

async function AssistantPanel({ scope }: { scope: Record<string, unknown> }) {
  const [noAccount, invited, noBatch, noMentor] = await Promise.all([
    User.find({ student: { $ne: null } }).distinct('student').then(ids => Student.countDocuments({ ...scope, _id: { $nin: ids } })),
    User.countDocuments({ status: 'invited' }),
    Student.countDocuments({ ...scope, batch: null }),
    Student.countDocuments({ ...scope, mentor: null }),
  ])
  return (
    <Card title="Operations" className="mt-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/students" className="rounded-lg border border-line p-3 hover:border-brand-300"><div className="text-2xl font-semibold tabular-nums">{noAccount}</div><div className="text-xs text-muted">students without an account</div></Link>
        <Link href="/users?status=invited" className="rounded-lg border border-line p-3 hover:border-brand-300"><div className="text-2xl font-semibold tabular-nums">{invited}</div><div className="text-xs text-muted">invitations not yet activated</div></Link>
        <Link href="/students?batch=none" className="rounded-lg border border-line p-3 hover:border-brand-300"><div className="text-2xl font-semibold tabular-nums">{noBatch}</div><div className="text-xs text-muted">students without a batch</div></Link>
        <Link href="/students?mentor=none" className="rounded-lg border border-line p-3 hover:border-brand-300"><div className="text-2xl font-semibold tabular-nums">{noMentor}</div><div className="text-xs text-muted">students without a mentor</div></Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><Link href="/attendance/register" className="btn-primary"><CalendarClock className="size-4" />Post today&apos;s attendance</Link><Link href="/students/import" className="btn-outline"><Upload className="size-4" />Bulk import students</Link><Link href="/users" className="btn-outline"><UserPlus className="size-4" />Manage accounts</Link></div>
    </Card>
  )
}
