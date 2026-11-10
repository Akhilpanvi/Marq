import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { can, requirePage, studentScope } from '@/lib/auth'
import { getStatuses } from '@/lib/settings'
import { statusTone } from '@/lib/placement'
import { day, dayTime } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Interview, Student } from '@/models'
import { Badge, Card, Empty, KV, PageHeader, Table } from '@/components/ui'
import { Modal } from '@/components/form'
import { AppTimeline, ApplicationForm, InterviewForm, StatusForm, resultTone } from '@/components/placement-ui'

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage('applications.view')
  const { id } = await params
  if (!OID.test(id)) notFound()
  const a = await Application.findById(id).lean()
  if (!a) notFound()
  const s = await Student.findOne({ $and: [{ _id: a.student }, await studentScope(me)] }).select('name regNo').lean()
  if (!s) notFound()
  const [interviews, statuses] = await Promise.all([Interview.find({ application: a._id }).sort({ at: 1 }).lean(), getStatuses()])
  const opt: [string, string][] = [[String(a._id), `${a.company} — ${a.role}`]]

  return (
    <>
      <PageHeader back={{ href: '/applications', label: 'Applications' }} title={`${a.company} · ${a.role}`} description={<>For <Link href={`/students/${s._id}`} className="text-accent hover:underline">{s.name} ({s.regNo})</Link></>}>
        {can(me, 'applications.edit') && <Modal label="Edit" title="Edit application" className="btn-outline" wide><ApplicationForm a={a} statuses={statuses} /></Modal>}
        {can(me, 'interviews.create') && <Modal label="Schedule interview" title="Schedule interview" wide><InterviewForm apps={opt} i={{ application: a._id }} /></Modal>}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Current status" action={<Badge tone={statusTone(a.status)}>{a.status}</Badge>}>
            {can(me, 'applications.edit') ? <StatusForm id={String(a._id)} current={a.status} statuses={statuses} student={String(a.student)} /> : <p className="text-sm text-muted">Read only.</p>}
          </Card>
          <Card title="Interviews" pad={false}>
            <Table head={['Round', 'When', 'Mode', 'Status', 'Result', 'Feedback']} empty={<Empty>No interviews recorded.</Empty>}>
              {interviews.map(i => <tr key={String(i._id)}><td className="td font-medium">{i.round}</td><td className="td text-muted">{dayTime(i.at)}</td><td className="td">{i.mode}</td><td className="td">{i.status}</td><td className="td"><Badge tone={resultTone(i.result)}>{i.result}</Badge></td><td className="td text-muted">{i.feedback}</td></tr>)}
            </Table>
          </Card>
          <Card title="Status timeline"><AppTimeline history={[...a.history].reverse()} /></Card>
        </div>
        <Card title="Details">
          <KV items={[['Source', a.source], ['Applied on', day(a.appliedOn)], ['Linked opportunity', a.job ? 'Published in MARQ' : 'Added independently'], ['Remarks', a.remarks]]} />
          {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-1.5 text-sm text-accent hover:underline"><ExternalLink className="size-3.5" />Application link</a>}
          {a.docs.length > 0 && <ul className="mt-4 space-y-1 text-sm">{a.docs.map((d, i) => <li key={i}><a href={d.url ?? '#'} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{d.title || 'Document'}</a></li>)}</ul>}
        </Card>
      </div>
    </>
  )
}
