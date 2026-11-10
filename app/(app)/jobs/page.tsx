import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { companyOptions } from '@/lib/options'
import { day } from '@/lib/format'
import { OID } from '@/lib/form'
import { Application, Job } from '@/models'
import { Badge, Card, Empty, PageHeader, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { JobFields } from '@/components/job-fields'
import { deleteJob, saveJob } from '@/app/actions/placement'

export const metadata = { title: 'Job Opportunities' }

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('jobs.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), company = sp(params, 'company'), status = sp(params, 'status'), type = sp(params, 'type'), edit = sp(params, 'edit')
  const filter: Record<string, unknown> = {}
  if (q) filter.role = new RegExp(escapeRe(q), 'i')
  if (OID.test(company)) filter.company = company
  if (status) filter.status = status
  if (type) filter.type = type
  const [jobs, total, companies, editing] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Job.countDocuments(filter),
    companyOptions(),
    OID.test(edit) && can(me, 'jobs.edit') ? Job.findById(edit).lean() : null,
  ])
  const counts = new Map((await Application.aggregate<{ _id: unknown; n: number }>([{ $match: { job: { $in: jobs.map(j => j._id) } } }, { $group: { _id: '$job', n: { $sum: 1 } } }])).map(c => [String(c._id), c.n]))
  const cName = new Map(companies)

  return (
    <>
      <PageHeader title="Job Opportunities" description="Published opportunities appear in every student's portal and notify them.">
        {can(me, 'jobs.create') && <Modal label={<><Plus className="size-4" />Publish opportunity</>} title="New opportunity" wide>{companies.length ? <ActionForm action={saveJob} submit="Save"><JobFields companies={companies} /></ActionForm> : <p className="text-sm text-muted">Add the company first under Companies.</p>}</Modal>}
      </PageHeader>
      {editing && <Card title={`Edit ${editing.role}`} className="mb-6" action={<Link href="/jobs" className="btn-ghost">Close</Link>}><ActionForm action={saveJob} submit="Save" reset={false}><JobFields j={editing} companies={companies} /></ActionForm></Card>}
      <Card pad={false}>
        <Filters params={params} placeholder="Search roles">
          <Select name="company" value={company} options={companies} all="All companies" />
          <Select name="type" value={type} options={['Full-time', 'Internship', 'Internship + Full-time', 'Contract']} all="All types" />
          <Select name="status" value={status} options={[['open', 'Open'], ['draft', 'Draft'], ['closed', 'Closed']]} all="All statuses" />
        </Filters>
        <Table head={['Role', 'Company', 'Package', 'Type', 'Deadline', 'Applicants', 'Status', '']} empty={<Empty>No opportunities yet.</Empty>}>
          {jobs.map(j => (
            <tr key={String(j._id)}>
              <td className="td"><div className="font-medium">{j.role}</div><div className="truncate text-xs text-muted">{j.skills.join(', ')}</div></td>
              <td className="td">{cName.get(String(j.company))}</td>
              <td className="td">{j.ctcText || (j.ctc ? `${j.ctc} LPA` : '—')}</td>
              <td className="td text-muted">{j.type}</td>
              <td className="td text-muted">{day(j.deadline)}</td>
              <td className="td tabular-nums"><Link href={`/applications?job=${j._id}`} className="hover:underline">{counts.get(String(j._id)) ?? 0}</Link></td>
              <td className="td"><Badge tone={j.status === 'open' ? 'green' : j.status === 'draft' ? 'amber' : 'zinc'}>{j.status}</Badge></td>
              <td className="td"><div className="flex justify-end gap-1">
                {can(me, 'jobs.edit') && <Link href={`/jobs?edit=${j._id}`} className="btn-ghost px-2 py-1 text-xs">Edit</Link>}
                {can(me, 'jobs.delete') && <ActionButton action={deleteJob} fields={{ id: String(j._id) }} className="btn-ghost px-2 py-1 text-red-600" confirm="Delete this opportunity?"><Trash2 className="size-3.5" /></ActionButton>}
              </div></td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/jobs" />
      </Card>
    </>
  )
}
