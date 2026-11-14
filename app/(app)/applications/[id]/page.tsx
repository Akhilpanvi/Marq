import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { can, requirePage, studentScope } from '@/lib/auth'
import { getStatuses } from '@/lib/settings'
import { driveLocked, EDIT_MINUTES, statusTone } from '@/lib/placement'
import { day } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Student } from '@/models'
import { Badge, Card, KV, PageHeader } from '@/components/ui'
import { ActionButton, Modal } from '@/components/form'
import { reopenDriveStatus } from '@/app/actions/placement'
import { AppTimeline, ApplicationForm, StatusForm } from '@/components/placement-ui'

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage('applications.view')
  const { id } = await params
  if (!OID.test(id)) notFound()
  const a = await Application.findById(id).lean()
  if (!a) notFound()
  const s = await Student.findOne({ $and: [{ _id: a.student }, await studentScope(me)] }).select('name regNo').lean()
  if (!s) notFound()
  const statuses = await getStatuses()

  return (
    <>
      <PageHeader back={{ href: '/applications', label: 'Applications' }} title={`${a.company} · ${a.role}`} description={<>For <Link href={`/students/${s._id}`} className="text-accent hover:underline">{s.name} ({s.regNo})</Link></>}>
        {can(me, 'applications.edit') && <Modal label="Edit" title="Edit application" className="btn-outline" wide><ApplicationForm a={a} statuses={statuses} /></Modal>}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Current status" action={<Badge tone={statusTone(a.status)}>{a.status}</Badge>}>
            {a.job && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span aria-hidden>{driveLocked(a) ? '🔒' : '✏️'}</span>
                <span>{driveLocked(a) ? 'Locked for the student (their edit window has ended).' : a.editUntil ? `The student can still change this until ${new Date(a.editUntil).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.` : 'Opened for the student.'}</span>
                {can(me, 'applications.edit') && driveLocked(a) && <ActionButton action={reopenDriveStatus} fields={{ id: String(a._id) }} className="btn-outline py-1 text-xs" confirm={`Let the student change this again for ${EDIT_MINUTES} minutes?`}>Reopen for {EDIT_MINUTES} min</ActionButton>}
              </p>
            )}
            {can(me, 'applications.edit') ? <StatusForm id={String(a._id)} current={a.status} statuses={statuses} student={String(a.student)} /> : <p className="text-sm text-muted">Read only.</p>}
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
