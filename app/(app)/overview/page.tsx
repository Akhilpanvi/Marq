import Link from 'next/link'
import { AlertTriangle, Banknote, CalendarClock, ClipboardCheck, GraduationCap, Trophy, Upload, UserPlus, Users } from 'lucide-react'
import { can, requireUser, scopedStudentIds, studentScope } from '@/lib/auth'
import { profiles } from '@/lib/intel'
import { appMetrics } from '@/lib/app-metrics'
import { attendancePct } from '@/lib/scoring'
import { visibleBatches } from '@/lib/scope'
import { getBudget } from '@/lib/settings'
import { ago, day, inr, pct } from '@/lib/format'
import { Assessment, AuditLog, Batch, Company, FinancialRecord, Interview, Student, TrainingSession, User, Attendance } from '@/models'
import { Badge, Card, Empty, Grid, Meter, PageHeader, Score, Stat, Table } from '@/components/ui'
import { Bars, Lines } from '@/components/charts'
import { MarqWordmark } from '@/components/logo'

export const metadata = { title: 'Overview' }
const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }

export default async function Overview() {
  const me = await requireUser()
  if (me.student) return null
  if (!can(me, 'students.view') && can(me, 'finance.view')) return <AccountsDashboard name={me.name} />

  const scope = await studentScope(me)
  const ids = await scopedStudentIds(me)
  const sMatch = ids ? { student: { $in: ids } } : {}
  const batchScope = await visibleBatches(me)
  const [students, prof, m, attMonthly, catAvg, conducted, upcomingSessions, upcomingInterviews, batches, recent] = await Promise.all([
    can(me, 'students.view') ? Student.find(scope).select('name regNo status batch').lean() : [],
    can(me, 'performance.view') ? profiles(ids) : new Map(),
    can(me, 'applications.view') ? appMetrics(sMatch) : null,
    can(me, 'attendance.view')
      ? Attendance.aggregate<{ _id: string; att: number; counted: number }>([{ $match: { ...sMatch, status: { $ne: 'excused' } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Kolkata' } }, att: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }, counted: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      : [],
    can(me, 'assessments.view') ? Assessment.aggregate<{ _id: string; avg: number }>([{ $lookup: { from: 'assessmentresults', localField: '_id', foreignField: 'assessment', as: 'r' } }, { $unwind: '$r' }, { $match: { 'r.marks': { $ne: null }, ...(ids ? { 'r.student': { $in: ids } } : {}) } }, { $group: { _id: '$category', avg: { $avg: { $multiply: [{ $divide: ['$r.marks', '$maxMarks'] }, 100] } } } }, { $sort: { avg: -1 } }]) : [],
    can(me, 'assessments.view') ? Assessment.countDocuments({ status: 'completed', ...(batchScope ? { batches: { $in: batchScope } } : {}) }) : 0,
    can(me, 'training.view') ? TrainingSession.find({ status: 'scheduled', date: { $gte: new Date(Date.now() - 12 * 3600_000) }, ...(batchScope ? { batch: { $in: batchScope } } : {}) }).select('title date start batch').sort({ date: 1 }).limit(6).lean() : [],
    can(me, 'interviews.view') ? Interview.find({ ...sMatch, status: 'scheduled', at: { $gte: new Date() } }).sort({ at: 1 }).limit(6).lean() : [],
    Batch.find(batchScope ? { _id: { $in: batchScope } } : {}).select('name').lean(),
    can(me, 'audit.view') ? AuditLog.find().sort({ at: -1 }).limit(8).lean() : [],
  ])

  // students restricted to those whose profiles we hold (scope already applied)
  const rows = students.map(s => ({ s, p: prof.get(String(s._id)) })).filter(r => r.p)
  const withScore = rows.filter(r => r.p!.overall != null)
  const top = [...withScore].sort((a, b) => b.p!.overall! - a.p!.overall!).slice(0, 5)
  const attention = rows.filter(r => r.p!.flags.attention || r.p!.flags.declining).sort((a, b) => (a.p!.overall ?? 0) - (b.p!.overall ?? 0)).slice(0, 6)
  const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}–${i * 10 + 10}`, students: 0 }))
  withScore.forEach(r => bins[Math.min(9, Math.floor(r.p!.overall! / 10))].students++)
  const cohort = batches.map(b => {
    const rs = rows.filter(r => String(r.s.batch) === String(b._id))
    return { batch: b.name, overall: Math.round((mean(rs.map(r => r.p!.overall)) ?? 0) * 10) / 10, attendance: Math.round((mean(rs.map(r => r.p!.dims.attendance)) ?? 0) * 10) / 10 }
  }).filter(c => c.overall || c.attendance)
  const att = attMonthly.reduce((a, r) => ({ att: a.att + r.att, counted: a.counted + r.counted }), { att: 0, counted: 0 })
  const sName = new Map(students.map(s => [String(s._id), s.name]))
  const bName = new Map(batches.map(b => [String(b._id), b.name]))
  const director = me.roleKey === 'director'
  const assistant = can(me, 'users.create') && can(me, 'students.create') && !can(me, 'training.create')

  return (
    <>
      <PageHeader
        title={director ? 'Executive Overview' : me.scope === 'assigned' ? `Welcome, ${me.name.split(' ')[0]}` : 'Programme Overview'}
        description={<span className="flex items-center gap-2"><MarqWordmark className="h-3 w-auto" /> Top Notch Marquee Training Programme · {me.roleName}</span>}
      />

      <Grid>
        <Stat label={me.scope === 'assigned' ? 'My students' : 'Total students'} value={students.length} icon={GraduationCap} href={can(me, 'students.view') ? '/students' : undefined} />
        <Stat label="Active students" value={students.filter(s => s.status === 'active').length} icon={Users} />
        <Stat label="Average attendance" value={pct(att.counted ? (att.att / att.counted) * 100 : null)} icon={CalendarClock} />
        <Stat label="Average performance" value={<Score value={mean(rows.map(r => r.p!.overall))} />} hint={`${withScore.length} with results`} icon={Trophy} />
        <Stat label="Assessments conducted" value={conducted} icon={ClipboardCheck} />
        {m && <Stat label="Total applications" value={m.total} href="/applications" />}
        {m && <Stat label="Companies applied" value={m.companies} />}
        {m && <Stat label="Total offers" value={m.offers} hint={`${m.accepted} accepted`} href="/placement" />}
      </Grid>

      {assistant && <AssistantPanel scope={scope} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Attendance trend" className="lg:col-span-2">
          <Lines data={attMonthly.map(r => ({ month: r._id, pct: Math.round(attendancePct({ present: r.att, absent: r.counted - r.att })! * 10) / 10 }))} x="month" series={[{ key: 'pct', label: 'Attendance %' }]} domain={[0, 100]} height={220} />
        </Card>
        <Card title="Performance distribution"><Bars data={bins} x="range" series={[{ key: 'students', label: 'Students' }]} height={220} /></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Cohort performance by batch"><Bars data={cohort} x="batch" series={[{ key: 'overall', label: 'Overall' }, { key: 'attendance', label: 'Attendance' }]} domain={[0, 100]} height={220} /></Card>
        <Card title="Assessment performance by category"><Bars data={catAvg.map(c => ({ category: c._id, avg: Math.round(c.avg * 10) / 10 }))} x="category" series={[{ key: 'avg', label: 'Average %' }]} domain={[0, 100]} horizontal height={Math.max(180, catAvg.length * 32)} /></Card>
      </div>

      {m && (
        <Card title="Placement progress" className="mt-6">
          <Bars data={[{ s: 'Applied', n: m.total }, { s: 'Written test', n: m.written }, { s: 'Technical', n: m.technical }, { s: 'HR', n: m.hr }, { s: 'Offers', n: m.offers }, { s: 'Accepted', n: m.accepted }]} x="s" series={[{ key: 'n', label: 'Applications' }]} height={200} />
          {director && <DirectorExtras />}
        </Card>
      )}

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
            {upcomingInterviews.map(i => <li key={String(i._id)}><span className="font-medium">{sName.get(String(i.student)) ?? 'Student'}</span> — {i.company}<div className="text-xs text-muted">Interview · {i.round} · {day(i.at)}</div></li>)}
            {!upcomingSessions.length && !upcomingInterviews.length && <li className="text-muted">Nothing scheduled.</li>}
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
  const [companies, selected] = await Promise.all([Company.countDocuments(), Interview.countDocuments({ result: 'cleared' })])
  return <p className="mt-3 text-sm text-muted">{companies} companies participating · {selected} interview rounds cleared</p>
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

async function AccountsDashboard({ name }: { name: string }) {
  const [budget, byStatus, recent] = await Promise.all([
    getBudget(),
    FinancialRecord.aggregate<{ _id: string; amount: number; n: number }>([{ $group: { _id: '$status', amount: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    FinancialRecord.find().sort({ createdAt: -1 }).limit(8).lean(),
  ])
  const s = (k: string) => byStatus.find(x => x._id === k) ?? { amount: 0, n: 0 }
  const spent = s('approved').amount
  return (
    <>
      <PageHeader title="Accounts Overview" description={`Welcome, ${name.split(' ')[0]}. Authorised training expenditure for the Marquee programme.`}><Link href="/finance" className="btn-primary"><Banknote className="size-4" />Financial records</Link></PageHeader>
      <Grid>
        <Stat label="Approved budget" value={budget ? inr(budget) : '—'} />
        <Stat label="Approved spend" value={inr(spent)} />
        <Stat label="Pending approval" value={inr(s('pending').amount)} hint={`${s('pending').n} records`} href="/finance?status=pending" />
        <Stat label="Remaining" value={budget ? inr(budget - spent) : '—'} />
      </Grid>
      {budget > 0 && <div className="card mt-4 p-4"><div className="mb-2 flex justify-between text-xs text-muted"><span>Budget utilisation</span><span>{Math.round((spent / budget) * 100)}%</span></div><Meter value={(spent / budget) * 100} tone="bg-[var(--color-c1)]" label="Budget utilisation" /></div>}
      <Card title="Latest records" className="mt-6" pad={false}>
        <Table head={['Date', 'Category', 'Description', 'Amount', 'Status']} empty={<Empty>No financial records yet.</Empty>}>
          {recent.map(r => <tr key={String(r._id)}><td className="td text-muted">{day(r.date)}</td><td className="td">{r.category}</td><td className="td">{r.description}</td><td className="td tabular-nums">{inr(r.amount)}</td><td className="td"><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Badge></td></tr>)}
        </Table>
      </Card>
    </>
  )
}
