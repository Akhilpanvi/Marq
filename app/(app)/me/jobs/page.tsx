import { ExternalLink } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { companyOptions } from '@/lib/options'
import { day } from '@/lib/format'
import { escapeRe } from '@/components/list'
import { Application, Company, Job } from '@/models'
import { Badge, Card, Empty, PageHeader } from '@/components/ui'
import { Filters, Select, sp } from '@/components/list'
import { ActionButton } from '@/components/form'
import { applyToJob } from '@/app/actions/placement'

export const metadata = { title: 'Job Opportunities' }

export default async function MyJobs({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireStudent()
  const params = await searchParams
  const q = sp(params, 'q'), type = sp(params, 'type'), company = sp(params, 'company'), min = Number(sp(params, 'min')) || 0
  const filter: Record<string, unknown> = { status: 'open' }
  if (q) filter.$or = [{ role: new RegExp(escapeRe(q), 'i') }, { skills: new RegExp(escapeRe(q), 'i') }, { location: new RegExp(escapeRe(q), 'i') }]
  if (type) filter.type = type
  if (/^[a-f0-9]{24}$/.test(company)) filter.company = company
  if (min) filter.ctc = { $gte: min }
  const [jobs, mine, companies] = await Promise.all([Job.find(filter).sort({ deadline: 1, createdAt: -1 }).limit(100).lean(), Application.find({ student: me.student }).select('job status').lean(), companyOptions()])
  const cos = new Map((await Company.find({ _id: { $in: jobs.map(j => j.company) } }).lean()).map(c => [String(c._id), c]))
  const applied = new Map(mine.filter(a => a.job).map(a => [String(a.job), a.status]))
  return (
    <>
      <PageHeader title="Job Opportunities" description="Opportunities published by the placement team. Applying here adds it to My Applications." />
      <Card pad={false} className="mb-6">
        <Filters params={params} placeholder="Search role, skill or location">
          <Select name="company" value={company} options={companies} all="All companies" />
          <Select name="type" value={type} options={['Full-time', 'Internship', 'Internship + Full-time', 'Contract']} all="All types" />
          <Select name="min" value={sp(params, 'min')} options={[['4', '4+ LPA'], ['8', '8+ LPA'], ['12', '12+ LPA'], ['20', '20+ LPA']]} all="Any package" />
        </Filters>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map(j => {
          const c = cos.get(String(j.company))
          const closed = !!j.deadline && j.deadline < new Date()
          const status = applied.get(String(j._id))
          return (
            <Card key={String(j._id)}>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c?.logo ? <img src={c.logo} alt="" className="size-10 rounded-md bg-white object-contain p-1 ring-1 ring-line" referrerPolicy="no-referrer" /> : <span className="grid size-10 place-items-center rounded-md bg-subtle font-semibold">{c?.name[0]}</span>}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{j.role}</div>
                  <div className="text-sm text-muted">{c?.name}{j.location ? ` · ${j.location}` : ''}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="green">{j.ctcText || (j.ctc ? `${j.ctc} LPA` : 'Package TBA')}</Badge><Badge>{j.type}</Badge>{j.deadline && <Badge tone={closed ? 'red' : 'amber'}>Apply by {day(j.deadline)}</Badge>}</div>
                </div>
              </div>
              {j.description && <p className="mt-3 line-clamp-3 text-sm whitespace-pre-line">{j.description}</p>}
              {j.skills.length > 0 && <p className="mt-2 text-xs text-muted">Skills: {j.skills.join(', ')}</p>}
              {j.eligibility && <p className="mt-1 text-xs text-muted">Eligibility: {j.eligibility}</p>}
              {j.process && <p className="mt-1 text-xs text-muted">Process: {j.process}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {status ? <Badge tone="blue">Applied · {status}</Badge> : closed ? <Badge tone="zinc">Deadline passed</Badge> : <ActionButton action={applyToJob} fields={{ job: String(j._id) }} className="btn-primary" confirm={`Apply to ${c?.name} — ${j.role}?`}>Apply</ActionButton>}
                {j.link && <a href={j.link} target="_blank" rel="noopener noreferrer" className="btn-ghost"><ExternalLink className="size-4" />Company link</a>}
              </div>
            </Card>
          )
        })}
      </div>
      {!jobs.length && <Empty>No open opportunities match.</Empty>}
    </>
  )
}
