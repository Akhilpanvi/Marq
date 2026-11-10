import Link from 'next/link'
import { Plus } from 'lucide-react'
import { can, requirePage, scopedStudentIds } from '@/lib/auth'
import { CLOSED } from '@/lib/placement'
import { dayTime } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Interview, Student } from '@/models'
import { Badge, Card, Empty, PageHeader, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'
import { Modal } from '@/components/form'
import { InterviewForm, resultTone } from '@/components/placement-ui'

export const metadata = { title: 'Interviews' }

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('interviews.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), status = sp(params, 'status'), result = sp(params, 'result'), edit = sp(params, 'edit')
  const ids = await scopedStudentIds(me)
  const base: Record<string, unknown> = ids ? { student: { $in: ids } } : {}
  const filter: Record<string, unknown> = { ...base }
  if (q) filter.company = new RegExp(escapeRe(q), 'i')
  if (status) filter.status = status
  if (result) filter.result = result
  const now = new Date()
  const [upcoming, list, total, openApps, editing] = await Promise.all([
    Interview.find({ ...base, status: 'scheduled', at: { $gte: now } }).sort({ at: 1 }).limit(20).lean(),
    Interview.find(filter).sort({ at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Interview.countDocuments(filter),
    can(me, 'interviews.create') ? Application.find({ ...base, status: { $nin: CLOSED } }).select('company role student').sort({ updatedAt: -1 }).limit(500).lean() : [],
    OID.test(edit) && can(me, 'interviews.edit') ? Interview.findOne({ _id: edit, ...base }).lean() : null,
  ])
  const students = await Student.find({ _id: { $in: [...upcoming, ...list, ...openApps].map(x => x.student) } }).select('name').lean()
  const sName = new Map(students.map(s => [String(s._id), s.name]))
  const appOpts: [string, string][] = openApps.map(a => [String(a._id), `${sName.get(String(a.student)) ?? ''} — ${a.company} · ${a.role}`])
  const soon = (d: Date) => +d - +now < 24 * 3600_000

  return (
    <>
      <PageHeader title="Interviews" description="Every round for every application, with reminders for upcoming interviews.">
        {can(me, 'interviews.create') && <Modal label={<><Plus className="size-4" />Schedule interview</>} title="Schedule interview" wide><InterviewForm apps={appOpts} /></Modal>}
      </PageHeader>
      {editing && <Card title="Edit interview" className="mb-6" action={<Link href="/interviews" className="btn-ghost">Close</Link>}><InterviewForm i={editing} apps={[[String(editing.application), `${sName.get(String(editing.student)) ?? ''} — ${editing.company} · ${editing.role}`], ...appOpts]} /></Card>}
      <Card title={`Upcoming · ${upcoming.length}`} className="mb-6" pad={false}>
        <Table head={['When', 'Student', 'Company', 'Round', 'Mode', '']} empty={<Empty>No upcoming interviews.</Empty>}>
          {upcoming.map(i => (
            <tr key={String(i._id)}>
              <td className="td">{dayTime(i.at)} {soon(i.at) && <Badge tone="amber">within 24h</Badge>}</td>
              <td className="td"><Link href={`/students/${i.student}`} className="font-medium hover:underline">{sName.get(String(i.student))}</Link></td>
              <td className="td">{i.company} <span className="text-muted">· {i.role}</span></td>
              <td className="td">{i.round}</td>
              <td className="td">{i.link ? <a href={i.link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{i.mode}</a> : i.mode}</td>
              <td className="td text-right">{can(me, 'interviews.edit') && <Link href={`/interviews?edit=${i._id}`} className="btn-ghost px-2 py-1 text-xs">Edit</Link>}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="All interviews" pad={false}>
        <Filters params={params} placeholder="Search company">
          <Select name="status" value={status} options={['scheduled', 'completed', 'cancelled', 'no-show']} all="All statuses" />
          <Select name="result" value={result} options={['pending', 'cleared', 'rejected', 'on-hold']} all="All results" />
        </Filters>
        <Table head={['When', 'Student', 'Company', 'Round', 'Status', 'Result', 'Feedback', '']}>
          {list.map(i => (
            <tr key={String(i._id)}>
              <td className="td text-muted">{dayTime(i.at)}</td>
              <td className="td"><Link href={`/students/${i.student}`} className="hover:underline">{sName.get(String(i.student))}</Link></td>
              <td className="td"><Link href={`/applications/${i.application}`} className="font-medium hover:underline">{i.company}</Link></td>
              <td className="td">{i.round}</td>
              <td className="td">{i.status}</td>
              <td className="td"><Badge tone={resultTone(i.result)}>{i.result}</Badge></td>
              <td className="td max-w-64 truncate text-muted">{i.feedback}</td>
              <td className="td text-right">{can(me, 'interviews.edit') && <Link href={`/interviews?edit=${i._id}`} className="btn-ghost px-2 py-1 text-xs">Edit</Link>}</td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/interviews" />
      </Card>
    </>
  )
}
