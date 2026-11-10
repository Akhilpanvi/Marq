import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { CLOSED } from '@/lib/placement'
import { dayTime } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Interview } from '@/models'
import { Badge, Card, Empty, PageHeader, Table } from '@/components/ui'
import { Modal } from '@/components/form'
import { InterviewForm, resultTone } from '@/components/placement-ui'

export const metadata = { title: 'My Interviews' }

export default async function MyInterviews({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const me = await requireStudent()
  const { edit } = await searchParams
  const [list, apps] = await Promise.all([Interview.find({ student: me.student }).sort({ at: -1 }).lean(), Application.find({ student: me.student }).select('company role status').lean()])
  const opts: [string, string][] = apps.filter(a => !CLOSED.includes(a.status)).map(a => [String(a._id), `${a.company} — ${a.role}`])
  const editing = OID.test(edit ?? '') ? list.find(i => String(i._id) === edit) : null
  const now = new Date()
  const upcoming = list.filter(i => i.status === 'scheduled' && i.at >= now).reverse()
  return (
    <>
      <PageHeader title="My Interviews" description="All your interview rounds. Interviews the placement team schedules for you appear here automatically.">
        {opts.length > 0 && <Modal label={<><Plus className="size-4" />Add interview</>} title="Add interview" wide><InterviewForm apps={opts} /></Modal>}
      </PageHeader>
      {editing && <Card title="Update interview" className="mb-6" action={<Link href="/me/interviews" className="btn-ghost">Close</Link>}><InterviewForm i={editing} apps={[[String(editing.application), `${editing.company} — ${editing.role}`], ...opts]} /></Card>}
      {upcoming.length > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map(i => (
            <div key={String(i._id)} className="card p-4">
              <div className="flex items-center justify-between"><span className="font-semibold">{i.company}</span>{+i.at - +now < 86400_000 && <Badge tone="amber">within 24h</Badge>}</div>
              <div className="text-sm text-muted">{i.round} · {i.role}</div>
              <div className="mt-2 text-sm">{dayTime(i.at)} · {i.mode}</div>
              {i.link && <a href={i.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-accent hover:underline">Join meeting ↗</a>}
            </div>
          ))}
        </div>
      )}
      <Card title="Interview history" pad={false}>
        <Table head={['When', 'Company', 'Round', 'Mode', 'Status', 'Result', 'Feedback', '']} empty={<Empty>No interviews yet.</Empty>}>
          {list.map(i => <tr key={String(i._id)}><td className="td text-muted">{dayTime(i.at)}</td><td className="td font-medium">{i.company}</td><td className="td">{i.round}</td><td className="td">{i.mode}</td><td className="td">{i.status}</td><td className="td"><Badge tone={resultTone(i.result)}>{i.result}</Badge></td><td className="td max-w-64 truncate text-muted">{i.feedback}</td><td className="td"><Link href={`/me/interviews?edit=${i._id}`} className="btn-ghost px-2 py-1 text-xs">Update</Link></td></tr>)}
        </Table>
      </Card>
    </>
  )
}
