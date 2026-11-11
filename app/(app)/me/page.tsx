import Link from 'next/link'
import { Briefcase, CalendarClock, ClipboardCheck, MessagesSquare, Video } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { journey } from '@/lib/journey'
import { appMetrics } from '@/lib/app-metrics'
import { placementStatus, statusTone } from '@/lib/placement'
import { day, dayTime } from '@/lib/format'
import { Assessment, Job, Student, TrainingSession } from '@/models'
import { Avatar, Badge, Card, Empty, KV, Meter, PageHeader } from '@/components/ui'
import { ScoreTiles } from '@/components/score-tiles'
import { Lines } from '@/components/charts'
import { AppMetricTiles } from '@/components/app-metrics'
import { EvaluationList } from '@/components/evaluation-list'

export const metadata = { title: 'My Dashboard' }

export default async function StudentDashboard() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('-photo.data').lean()
  if (!s) return <Empty>Your student record could not be found. Contact the programme office.</Empty>
  const [j, m, sessions, assessments] = await Promise.all([
    journey(s._id, s.batch),
    appMetrics({ student: s._id }),
    s.batch ? TrainingSession.find({ batch: s.batch, status: 'scheduled', date: { $gte: new Date(Date.now() - 12 * 3600_000) } }).select('title date start venue mode').sort({ date: 1 }).limit(5).lean() : [],
    Assessment.find({ status: 'scheduled', date: { $gte: new Date(Date.now() - 12 * 3600_000) }, $or: [{ batches: s.batch }, { batches: { $size: 0 } }] }).select('name category date').sort({ date: 1 }).limit(5).lean(),
  ])
  const placed = placementStatus(j.apps)
  const answered = new Set(j.apps.map(a => String(a.job)))
  const pendingDrives = (await Job.find({ status: { $in: ['open', 'closed'] } }).select('_id').lean()).filter(x => !answered.has(String(x._id))).length
  const upcomingInterviews = j.interviews.filter(i => i.status === 'scheduled' && i.at >= new Date()).sort((a, b) => +a.at - +b.at)

  return (
    <>
      <PageHeader title={`Welcome, ${s.name.split(' ')[0]}`} description="Your Marquee journey at a glance." />
      <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <Avatar name={s.name} src={s.photo?.type ? `/api/students/${s._id}/photo` : null} size="size-14" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{s.name}</div>
          <div className="text-sm text-muted">{s.regNo} · {[s.department, s.specialization].filter(Boolean).join(' · ')}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone="blue">{j.batch?.name ?? 'No batch yet'}</Badge><Badge tone={placed.tone}>{placed.label}</Badge></div>
        </div>
        <div className="w-full sm:w-48">
          <div className="mb-1 flex justify-between text-xs text-muted"><span>Training progress</span><span>{j.training.completed}/{j.training.total}</span></div>
          <Meter value={j.training.total ? (j.training.completed / j.training.total) * 100 : 0} tone="bg-[var(--color-c1)]" label="Training progress" />
        </div>
      </div>

      {pendingDrives > 0 && <Link href="/me/jobs" className="mb-6 block rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><b>{pendingDrives} company drive{pendingDrives === 1 ? '' : 's'}</b> need your status — update now →</Link>}
      <ScoreTiles p={j.p} explain="/me/performance#formula" />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="My assessment trend" className="lg:col-span-2"><Lines data={j.trend} x="date" series={[{ key: 'pct', label: 'Score %' }]} domain={[0, 100]} height={220} /></Card>
        <Card title="Coming up" icon={CalendarClock}>
          <ul className="space-y-3 text-sm">
            {sessions.map(x => <li key={String(x._id)}><div className="font-medium">{x.title}</div><div className="text-xs text-muted">Training · {day(x.date)}{x.start ? ` ${x.start}` : ''}{x.venue ? ` · ${x.venue}` : ''}</div></li>)}
            {assessments.map(a => <li key={String(a._id)}><div className="font-medium">{a.name}</div><div className="text-xs text-muted">Assessment · {a.category} · {day(a.date)}</div></li>)}
            {upcomingInterviews.map(i => <li key={String(i._id)}><div className="font-medium">{i.company} — {i.round}</div><div className="text-xs text-muted">Interview · {dayTime(i.at)}</div></li>)}
            {!sessions.length && !assessments.length && !upcomingInterviews.length && <li className="text-muted">Nothing scheduled.</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-6"><AppMetricTiles m={m} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Latest mentor feedback" icon={MessagesSquare} action={<Link href="/me/performance" className="text-xs text-accent hover:underline">All feedback</Link>}>
          <EvaluationList items={j.evaluations.slice(0, 2)} mentorName={j.mentorName} />
        </Card>
        <Card title="My applications" icon={Briefcase} pad={false} action={<Link href="/me/applications" className="text-xs text-accent hover:underline">Manage</Link>}>
          <ul className="divide-y divide-line">
            {j.apps.slice(0, 6).map(a => <li key={String(a._id)} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm"><span><b>{a.company}</b> <span className="text-muted">· {a.role}</span></span><Badge tone={statusTone(a.status)}>{a.status}</Badge></li>)}
            {!j.apps.length && <li className="p-5"><Empty>No applications yet. <Link className="text-accent hover:underline" href="/me/jobs">Browse opportunities</Link></Empty></li>}
          </ul>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Interview schedule" icon={Video}>
          {upcomingInterviews.length ? <KV items={upcomingInterviews.slice(0, 6).map(i => [`${i.company} · ${i.round}`, `${dayTime(i.at)} · ${i.mode}`] as [string, string])} /> : <Empty>No upcoming interviews.</Empty>}
        </Card>
        <Card title="Recent results" icon={ClipboardCheck}>
          {j.results.length ? <KV items={[...j.results].reverse().slice(0, 6).map(r => [r.name, r.marks == null ? 'Absent' : `${r.marks}/${r.max} (${Math.round((r.marks / r.max) * 100)}%)`] as [string, string])} /> : <Empty>No results yet.</Empty>}
        </Card>
      </div>
    </>
  )
}
