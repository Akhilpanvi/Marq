import Link from 'next/link'
import { Download, Plus } from 'lucide-react'
import { can, requirePage, scopedStudentIds, studentScope } from '@/lib/auth'
import { appMetrics } from '@/lib/app-metrics'
import { getStatuses } from '@/lib/settings'
import { statusTone } from '@/lib/placement'
import { day } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Student } from '@/models'
import { Badge, Card, Empty, PageHeader, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'
import { Modal } from '@/components/form'
import { AppMetricTiles } from '@/components/app-metrics'
import { ApplicationForm } from '@/components/placement-ui'

export const metadata = { title: 'Applications' }

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('applications.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), status = sp(params, 'status'), source = sp(params, 'source'), job = sp(params, 'job'), student = sp(params, 'student')
  const ids = await scopedStudentIds(me)
  const base: Record<string, unknown> = ids ? { student: { $in: ids } } : {}
  const filter: Record<string, unknown> = { ...base }
  if (q) filter.$or = [{ company: new RegExp(escapeRe(q), 'i') }, { role: new RegExp(escapeRe(q), 'i') }]
  if (status) filter.status = status
  if (source) filter.source = source
  if (OID.test(job)) filter.job = job
  if (OID.test(student)) filter.student = ids && !ids.some(i => String(i) === student) ? null : student
  const [apps, total, m, statuses, sources, students] = await Promise.all([
    Application.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Application.countDocuments(filter),
    appMetrics(base),
    getStatuses(),
    Application.distinct('source', base),
    Student.find(await studentScope(me)).select('name regNo').sort({ regNo: 1 }).lean(),
  ])
  const sName = new Map(students.map(s => [String(s._id), s]))

  return (
    <>
      <PageHeader title="Applications" description="Every application with its full status history — from students and placement staff.">
        {can(me, 'reports.export') && <a className="btn-outline" href="/api/reports/applications?format=xlsx"><Download className="size-4" />Export</a>}
        {can(me, 'applications.create') && <Modal label={<><Plus className="size-4" />Record application</>} title="Record application for a student" wide><ApplicationForm statuses={statuses} students={students.map(s => [String(s._id), `${s.name} (${s.regNo})`])} /></Modal>}
      </PageHeader>
      <AppMetricTiles m={m} />
      <Card pad={false} className="mt-6">
        <Filters params={params} placeholder="Search company or role">
          <Select name="status" value={status} options={statuses} all="All statuses" />
          <Select name="source" value={source} options={sources.filter(Boolean)} all="All sources" />
          <Select name="student" value={student} options={students.map(s => [String(s._id), s.name])} all="All students" />
        </Filters>
        <Table head={['Student', 'Company', 'Role', 'Source', 'Applied', 'Status', 'Updated']} empty={<Empty>No applications match.</Empty>}>
          {apps.map(a => (
            <tr key={String(a._id)} className="hover:bg-subtle/50">
              <td className="td"><Link href={`/students/${a.student}`} className="font-medium hover:underline">{sName.get(String(a.student))?.name ?? '—'}</Link></td>
              <td className="td"><Link href={`/applications/${a._id}`} className="font-medium hover:underline">{a.company}</Link></td>
              <td className="td">{a.role}</td>
              <td className="td text-muted">{a.source}</td>
              <td className="td text-muted">{day(a.appliedOn)}</td>
              <td className="td"><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
              <td className="td text-muted">{day(a.updatedAt)}</td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/applications" />
      </Card>
    </>
  )
}
