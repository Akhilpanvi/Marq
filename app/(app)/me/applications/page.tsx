import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { appMetrics } from '@/lib/app-metrics'
import { getStatuses } from '@/lib/settings'
import { statusTone } from '@/lib/placement'
import { day } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Interview } from '@/models'
import { Badge, Card, Empty, PageHeader } from '@/components/ui'
import { Modal } from '@/components/form'
import { AppMetricTiles } from '@/components/app-metrics'
import { AppTimeline, ApplicationForm, InterviewForm, StatusForm } from '@/components/placement-ui'

export const metadata = { title: 'My Applications' }

export default async function MyApplications({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const me = await requireStudent()
  const { open } = await searchParams
  const [apps, m, statuses, interviews] = await Promise.all([
    Application.find({ student: me.student }).sort({ updatedAt: -1 }).lean(),
    appMetrics({ student: me.student }),
    getStatuses(),
    Interview.find({ student: me.student }).select('application round at status').lean(),
  ])
  const ints = (id: unknown) => interviews.filter(i => String(i.application) === String(id))
  const selected = OID.test(open ?? '') ? apps.find(a => String(a._id) === open) : null
  return (
    <>
      <PageHeader title="My Applications" description="Track every application — from MARQ opportunities or ones you found yourself. Each status change is kept in the timeline.">
        <Modal label={<><Plus className="size-4" />Add application</>} title="Add an application" wide><ApplicationForm statuses={statuses} /></Modal>
      </PageHeader>
      <AppMetricTiles m={m} />
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card pad={false} className="lg:col-span-2">
          <ul className="divide-y divide-line">
            {apps.map(a => (
              <li key={String(a._id)}>
                <Link href={`/me/applications?open=${a._id}`} className={`block px-5 py-3 hover:bg-subtle/60 ${String(selected?._id) === String(a._id) ? 'bg-accent-soft/50' : ''}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{a.company}</span><Badge tone={statusTone(a.status)}>{a.status}</Badge></div>
                  <div className="text-xs text-muted">{a.role} · {a.source} · applied {day(a.appliedOn ?? a.createdAt)}</div>
                </Link>
              </li>
            ))}
            {!apps.length && <li className="p-5"><Empty>No applications yet. <Link href="/me/jobs" className="text-accent hover:underline">Browse opportunities</Link> or add one you applied to yourself.</Empty></li>}
          </ul>
        </Card>
        <div className="space-y-6 lg:col-span-3">
          {selected ? (
            <>
              <Card title={`${selected.company} · ${selected.role}`} action={<Modal label="Edit details" title="Edit application" className="btn-ghost py-1 text-xs" wide><ApplicationForm a={selected} statuses={statuses} /></Modal>}>
                <p className="mb-3 text-sm text-muted">Update the status as you progress. Previous statuses are never overwritten.</p>
                <StatusForm id={String(selected._id)} current={selected.status} statuses={statuses} />
                {selected.link && <a href={selected.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent hover:underline">Application link ↗</a>}
              </Card>
              <Card title="Interviews" action={<Modal label="Add interview" title="Add interview round" className="btn-ghost py-1 text-xs" wide><InterviewForm apps={[[String(selected._id), `${selected.company} — ${selected.role}`]]} i={{ application: selected._id }} /></Modal>}>
                {ints(selected._id).length ? <ul className="space-y-1 text-sm">{ints(selected._id).map(i => <li key={String(i._id)}>{i.round} · {day(i.at)} · <span className="text-muted">{i.status}</span></li>)}</ul> : <Empty>No interviews recorded for this application.</Empty>}
              </Card>
              <Card title="Timeline"><AppTimeline history={[...selected.history].reverse()} /></Card>
            </>
          ) : <Empty>Select an application to update its status and see its timeline.</Empty>}
        </div>
      </div>
    </>
  )
}
