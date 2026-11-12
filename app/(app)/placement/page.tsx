import type { Types } from 'mongoose'
import Link from 'next/link'
import { requirePage, scopedStudentIds } from '@/lib/auth'
import { appMetrics } from '@/lib/app-metrics'
import { OFFERED, REJECTED } from '@/lib/placement'
import { pct } from '@/lib/format'
import { Application, Job, Student } from '@/models'
import { Card, Grid, PageHeader, Stat, Table, Empty } from '@/components/ui'
import { Bars } from '@/components/charts'
import { Modal } from '@/components/form'
import { AppMetricTiles } from '@/components/app-metrics'

export const metadata = { title: 'Placement Analytics' }

export default async function PlacementPage() {
  const me = await requirePage('applications.view')
  const ids = await scopedStudentIds(me)
  const match: Record<string, unknown> = ids ? { student: { $in: ids } } : {}
  const sMatch = ids ? { _id: { $in: ids } } : {}
  const applied = { ...match, status: { $ne: 'Not Applied' } } // "No, I didn't apply" answers are not applications
  const [m, students, placed, offered, byCompany, monthly, packages, topStudents] = await Promise.all([
    appMetrics(match),
    Student.countDocuments({ ...sMatch, status: { $ne: 'withdrawn' } }),
    Application.distinct('student', { ...match, status: 'Accepted' }),
    Application.distinct('student', { ...match, status: { $in: OFFERED } }),
    Application.aggregate<{ _id: string; apps: number; offers: number; accepted: number; rejected: number; inProcess: number }>([
      { $match: applied },
      { $group: { _id: '$company', apps: { $sum: 1 }, offers: { $sum: { $cond: [{ $in: ['$status', OFFERED] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $in: ['$status', REJECTED] }, 1, 0] } } } },
      { $sort: { apps: -1 } }, { $limit: 30 },
    ]),
    Application.aggregate<{ _id: string; n: number }>([{ $match: applied }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: { $ifNull: ['$appliedOn', '$createdAt'] }, timezone: 'Asia/Kolkata' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Application.aggregate<{ _id: null; max: number; avg: number; n: number }>([
      { $match: { ...match, status: 'Accepted', job: { $ne: null } } },
      { $lookup: { from: 'jobs', localField: 'job', foreignField: '_id', as: 'j' } }, { $unwind: '$j' }, { $match: { 'j.ctc': { $gt: 0 } } },
      { $group: { _id: null, max: { $max: '$j.ctc' }, avg: { $avg: '$j.ctc' }, n: { $sum: 1 } } },
    ]),
    Application.aggregate<{ _id: unknown; apps: number; offers: number }>([
      { $match: applied }, { $group: { _id: '$student', apps: { $sum: 1 }, offers: { $sum: { $cond: [{ $in: ['$status', OFFERED] }, 1, 0] } } } }, { $sort: { offers: -1, apps: -1 } }, { $limit: 10 },
    ]),
  ])
  const names = new Map((await Student.find({ _id: { $in: topStudents.map(t => t._id as Types.ObjectId) } }).select('name').lean()).map(s => [String(s._id), s.name]))
  const openJobs = await Job.countDocuments({ status: 'open' })
  const funnel = [
    { stage: 'Applied', n: m.total },
    { stage: 'Written test', n: m.written },
    { stage: 'Technical round', n: m.technical },
    { stage: 'HR round', n: m.hr },
    { stage: 'Offers', n: m.offers },
    { stage: 'Accepted', n: m.accepted },
  ]
  const pk = packages[0]

  return (
    <>
      <PageHeader title="Placement Analytics" description="Built from students’ drive status answers, applications and offers." />
      <Grid>
        <Stat label="Students placed" value={placed.length} hint={`${pct(students ? (placed.length / students) * 100 : null)} of ${students}`} />
        <Stat label="Students with offers" value={offered.length} />
        <Stat label="Highest package (accepted)" value={pk ? `${pk.max} LPA` : '—'} hint={pk ? `Average ${pk.avg.toFixed(1)} LPA across ${pk.n}` : 'Needs accepted offers on published jobs'} />
        <Stat label="Open opportunities" value={openJobs} />
      </Grid>
      <div className="my-6"><AppMetricTiles m={m} /></div>
      <Card title="Stage counts (current status)"><Bars data={funnel} x="stage" series={[{ key: 'n', label: 'Applications' }]} height={240} /></Card>
      <DriveResponses match={match} studentFilter={sMatch} />
      <Card title="Applications per month" className="my-6"><Bars data={monthly.map(x => ({ month: x._id, n: x.n }))} x="month" series={[{ key: 'n', label: 'Applications' }]} height={220} /></Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Company-wise recruitment" className="lg:col-span-2" pad={false}>
          <Table head={['Company', 'Applications', 'Offers', 'Accepted', 'Rejected']} empty={<Empty>No applications yet.</Empty>}>
            {byCompany.map(c => <tr key={c._id}><td className="td font-medium">{c._id}</td><td className="td tabular-nums">{c.apps}</td><td className="td tabular-nums">{c.offers}</td><td className="td tabular-nums">{c.accepted}</td><td className="td tabular-nums">{c.rejected}</td></tr>)}
          </Table>
        </Card>
        <Card title="Student-wise" pad={false}>
          <Table head={['Student', 'Applied to', 'Offers']} empty={<Empty>No applications yet.</Empty>}>
            {topStudents.map(t => <tr key={String(t._id)}><td className="td"><Link href={`/students/${t._id}`} className="hover:underline">{names.get(String(t._id))}</Link></td><td className="td tabular-nums">{t.apps}</td><td className="td tabular-nums">{t.offers}</td></tr>)}
          </Table>
        </Card>
      </div>
    </>
  )
}

/** Per drive: who applied, who answered "Not applied", and who hasn't responded — each with names. */
async function DriveResponses({ match, studentFilter }: { match: Record<string, unknown>; studentFilter: Record<string, unknown> }) {
  const [jobs, students] = await Promise.all([
    Job.find({ status: { $in: ['open', 'closed'] } }).populate<{ company: { name: string } }>('company', 'name').sort({ createdAt: 1 }).lean(),
    Student.find({ ...studentFilter, status: 'active' }).select('name regNo').sort({ regNo: 1 }).lean(),
  ])
  const apps = await Application.find({ ...match, job: { $in: jobs.map(j => j._id) } }).select('job student status').lean()
  const rows = jobs.map(j => {
    const a = apps.filter(x => String(x.job) === String(j._id))
    const said = new Map(a.map(x => [String(x.student), x.status]))
    return {
      j,
      applied: students.filter(s => said.has(String(s._id)) && said.get(String(s._id)) !== 'Not Applied'),
      notApplied: students.filter(s => said.get(String(s._id)) === 'Not Applied'),
      noResponse: students.filter(s => !said.has(String(s._id))),
    }
  })
  const list = (title: string, tone: string, xs: typeof students) => (
    <div>
      <h3 className={`mb-2 font-semibold ${tone}`}>{title} · {xs.length}</h3>
      <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto text-sm">
        {xs.map(s => <li key={String(s._id)} className="flex justify-between gap-3 py-1.5"><Link href={`/students/${s._id}`} className="hover:underline">{s.name}</Link><span className="font-mono text-xs text-muted">{s.regNo}</span></li>)}
        {!xs.length && <li className="py-2 text-muted">None</li>}
      </ul>
    </div>
  )
  return (
    <Card title="Drive responses" className="my-6" pad={false}>
      <Table head={['Drive', 'Applied', 'Not applied', 'No response', '']} empty={<Empty>No drives yet.</Empty>}>
        {rows.map(r => (
          <tr key={String(r.j._id)}>
            <td className="td"><div className="font-medium">{r.j.company?.name}</div><div className="text-xs text-muted">{r.j.role}</div></td>
            <td className="td tabular-nums text-emerald-600">{r.applied.length}</td>
            <td className="td tabular-nums">{r.notApplied.length}</td>
            <td className="td tabular-nums text-amber-600">{r.noResponse.length}</td>
            <td className="td text-right">
              <Modal label="View names" title={`${r.j.company?.name} · ${r.j.role}`} className="btn-ghost px-2 py-1 text-xs" wide>
                <div className="grid gap-6 sm:grid-cols-3">
                  {list('Applied', 'text-emerald-600', r.applied)}
                  {list('Not applied', 'text-fg', r.notApplied)}
                  {list('No response', 'text-amber-600', r.noResponse)}
                </div>
              </Modal>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
