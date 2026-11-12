import { ExternalLink } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { companyOptions } from '@/lib/options'
import { day } from '@/lib/format'
import { escapeRe } from '@/components/list'
import { Application, Company, Job } from '@/models'
import { Badge, Card, Empty, PageHeader } from '@/components/ui'
import { Filters, Select, sp } from '@/components/list'
import { DriveStatus } from '@/components/drive-status'
import { driveLabel } from '@/lib/placement'

export const metadata = { title: 'Job Opportunities' }

export default async function MyJobs({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireStudent()
  const params = await searchParams
  const q = sp(params, 'q'), type = sp(params, 'type'), company = sp(params, 'company'), min = Number(sp(params, 'min')) || 0
  const filter: Record<string, unknown> = { status: { $in: ['open', 'closed'] } }
  if (q) filter.$or = [{ role: new RegExp(escapeRe(q), 'i') }, { skills: new RegExp(escapeRe(q), 'i') }, { location: new RegExp(escapeRe(q), 'i') }]
  if (type) filter.type = type
  if (/^[a-f0-9]{24}$/.test(company)) filter.company = company
  if (min) filter.ctc = { $gte: min }
  const [jobs, mine, companies] = await Promise.all([Job.find(filter).sort({ status: -1, deadline: 1, createdAt: -1 }).limit(100).lean(), Application.find({ student: me.student }).select('job status').lean(), companyOptions()])
  const cos = new Map((await Company.find({ _id: { $in: jobs.map(j => j.company) } }).lean()).map(c => [String(c._id), c]))
  const applied = new Map(mine.filter(a => a.job).map(a => [String(a.job), a.status]))
  const unanswered = jobs.filter(j => !applied.has(String(j._id))).length
  return (
    <>
      <PageHeader title="Job Opportunities" description="Drives published by the placement team. For every drive, answer two quick questions — did you apply, and how far have you reached. Update it whenever something changes; it feeds the programme's placement analysis." />
      {jobs.length > 0 && (unanswered > 0
        ? <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">You’ve answered <b>{jobs.length - unanswered} of {jobs.length}</b> drives — <b>{unanswered} drive{unanswered === 1 ? '' : 's'}</b> still need your status. Answer “Did you apply?” on each card below — “No” counts as an answer.</div>
        : <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">✓ You’ve answered all <b>{jobs.length}</b> drives. Update a card whenever something changes.</div>)}
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
          const closed = j.status === 'closed' || (!!j.deadline && j.deadline < new Date())
          const status = applied.get(String(j._id))
          return (
            <Card key={String(j._id)}>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c?.logo ? <img src={c.logo} alt="" className="size-10 rounded-md bg-white object-contain p-1 ring-1 ring-line" referrerPolicy="no-referrer" /> : <span className="grid size-10 place-items-center rounded-md bg-subtle font-semibold">{c?.name[0]}</span>}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{j.role}{j.status === 'closed' && <span className="ml-2"><Badge tone="zinc">Registration closed</Badge></span>}</div>
                  <div className="text-sm text-muted">{c?.name}{j.location ? ` · ${j.location}` : ''}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="green">{j.ctcText || (j.ctc ? `${j.ctc} LPA` : 'Package TBA')}</Badge><Badge>{j.type}</Badge>{j.deadline && <Badge tone={closed ? 'red' : 'amber'}>Apply by {day(j.deadline)}</Badge>}</div>
                </div>
              </div>
              {j.description && <p className="mt-3 line-clamp-3 text-sm whitespace-pre-line">{j.description}</p>}
              {j.skills.length > 0 && <p className="mt-2 text-xs text-muted">Skills: {j.skills.join(', ')}</p>}
              {j.eligibility && <p className="mt-1 text-xs text-muted">Eligibility: {j.eligibility}</p>}
              {j.process && <p className="mt-1 text-xs text-muted">Process: {j.process}</p>}
              {j.link && <div className="mt-3"><a href={j.link} target="_blank" rel="noopener noreferrer" className="btn-ghost -ml-2"><ExternalLink className="size-4" />Apply on the company site</a></div>}
              <DriveStatus job={String(j._id)} status={status} formLabel={driveLabel(status)} />
            </Card>
          )
        })}
      </div>
      {!jobs.length && <Empty>No open opportunities match.</Empty>}
    </>
  )
}
