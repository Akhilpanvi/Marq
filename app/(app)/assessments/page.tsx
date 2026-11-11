import Link from 'next/link'
import { Plus } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { batchOptions, trainerOptions } from '@/lib/options'
import { visibleBatches } from '@/lib/scope'
import { CATEGORIES } from '@/lib/scoring'
import { day } from '@/lib/format'
import { Assessment, AssessmentResult, User } from '@/models'
import { Badge, Card, Grid, PageHeader, Score, Stat, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'
import { ActionForm, Modal } from '@/components/form'
import { AssessmentFields } from '@/components/assessment-fields'
import { Bars } from '@/components/charts'
import { saveAssessment } from '@/app/actions/assessments'

export const metadata = { title: 'Assessments' }

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('assessments.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), category = sp(params, 'category'), batch = sp(params, 'batch'), status = sp(params, 'status')
  const scope = await visibleBatches(me)
  const filter: Record<string, unknown> = {}
  if (scope) filter.$or = [{ batches: { $in: scope } }, { trainer: me._id }, { batches: { $size: 0 } }]
  if (q) filter.name = new RegExp(escapeRe(q), 'i')
  if (category) filter.category = category
  if (batch) filter.batches = batch
  if (status) filter.status = status
  const [list, total, bOpts, tOpts] = await Promise.all([
    Assessment.find(filter).sort({ date: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Assessment.countDocuments(filter),
    batchOptions(), trainerOptions(),
  ])
  const ids = list.map(a => a._id)
  const [stats, catAvg, trainers] = await Promise.all([
    AssessmentResult.aggregate<{ _id: unknown; n: number; absent: number; avg: number }>([
      { $match: { assessment: { $in: ids } } },
      { $lookup: { from: 'assessments', localField: 'assessment', foreignField: '_id', as: 'a' } }, { $unwind: '$a' },
      { $group: { _id: '$assessment', n: { $sum: { $cond: [{ $eq: ['$marks', null] }, 0, 1] } }, absent: { $sum: { $cond: [{ $eq: ['$marks', null] }, 1, 0] } }, avg: { $avg: { $cond: [{ $eq: ['$marks', null] }, null, { $multiply: [{ $divide: ['$marks', '$a.maxMarks'] }, 100] }] } } } },
    ]),
    AssessmentResult.aggregate<{ _id: string; avg: number; n: number }>([
      { $match: { marks: { $ne: null } } },
      { $lookup: { from: 'assessments', localField: 'assessment', foreignField: '_id', as: 'a' } }, { $unwind: '$a' },
      ...(scope ? [{ $match: { $or: [{ 'a.batches': { $in: scope } }, { 'a.trainer': me._id }] } }] : []),
      { $group: { _id: '$a.category', avg: { $avg: { $multiply: [{ $divide: ['$marks', '$a.maxMarks'] }, 100] } }, n: { $sum: 1 } } },
      { $sort: { avg: -1 } },
    ]),
    User.find({ _id: { $in: list.flatMap(a => (a.trainer ? [a.trainer] : [])) } }).select('name').lean(),
  ])
  const st = new Map(stats.map(s => [String(s._id), s]))
  const tName = new Map(trainers.map(t => [String(t._id), t.name]))
  const visibleB = scope ? bOpts.filter(([id]) => scope.some(b => String(b) === id)) : bOpts
  const conducted = await Assessment.countDocuments({ ...filter, status: 'completed' })

  return (
    <>
      <PageHeader title="Assessment Centre" description="Technical, coding, aptitude and communication assessments.">
        {can(me, 'assessments.create') && (
          <Modal label={<><Plus className="size-4" />New assessment</>} title="New assessment" wide>
            <ActionForm action={saveAssessment} submit="Create"><AssessmentFields batches={visibleB} trainers={tOpts} /></ActionForm>
          </Modal>
        )}
      </PageHeader>
      <Grid>
        <Stat label="Assessments" value={total} hint={`${conducted} conducted`} />
        <Stat label="Categories assessed" value={catAvg.length} />
        <Stat label="Results recorded" value={catAvg.reduce((s, c) => s + c.n, 0)} />
        <Stat label="Average score" value={<Score value={catAvg.length ? catAvg.reduce((s, c) => s + c.avg * c.n, 0) / catAvg.reduce((s, c) => s + c.n, 0) : null} />} />
      </Grid>
      <Card title="Average by category" className="my-6">
        <Bars data={catAvg.map(c => ({ category: c._id, avg: Math.round(c.avg * 10) / 10 }))} x="category" series={[{ key: 'avg', label: 'Average %' }]} domain={[0, 100]} horizontal height={Math.max(160, catAvg.length * 34)} />
      </Card>
      <Card pad={false}>
        <Filters params={params} placeholder="Search assessments">
          <Select name="category" value={category} options={[...CATEGORIES]} all="All categories" />
          <Select name="batch" value={batch} options={visibleB} all="All batches" />
          <Select name="status" value={status} options={[['scheduled', 'Scheduled'], ['completed', 'Completed']]} all="All statuses" />
        </Filters>
        <Table head={['Assessment', 'Category', 'Date', 'Max', 'Trainer', 'Results', 'Average', 'Status']}>
          {list.map(a => {
            const s = st.get(String(a._id))
            return (
              <tr key={String(a._id)} className="hover:bg-subtle/50">
                <td className="td"><Link href={`/assessments/${a._id}`} className="font-medium hover:underline">{a.name}</Link></td>
                <td className="td text-muted">{a.category}</td>
                <td className="td text-muted">{day(a.date)}</td>
                <td className="td tabular-nums">{a.maxMarks}</td>
                <td className="td">{tName.get(String(a.trainer)) ?? '—'}</td>
                <td className="td tabular-nums">{s ? `${s.n}${s.absent ? ` (+${s.absent} AB)` : ''}` : 0}</td>
                <td className="td"><Score value={s?.avg} /></td>
                <td className="td"><Badge tone={a.status === 'completed' ? 'green' : 'amber'}>{a.status}</Badge></td>
              </tr>
            )
          })}
        </Table>
        <Pager page={page} total={total} params={params} path="/assessments" />
      </Card>
    </>
  )
}
