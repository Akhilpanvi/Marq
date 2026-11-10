import { requireStudent } from '@/lib/auth'
import { resultPoints } from '@/lib/intel'
import { day } from '@/lib/format'
import { Assessment, AssessmentResult, Student } from '@/models'
import { Badge, Card, Empty, PageHeader, Score, Table } from '@/components/ui'

export const metadata = { title: 'My Assessments' }

export default async function MyAssessments() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('batch').lean()
  const [results, upcoming] = await Promise.all([
    resultPoints({ student: me.student }),
    Assessment.find({ status: 'scheduled', date: { $gte: new Date(Date.now() - 12 * 3600_000) }, $or: [{ batches: s?.batch }, { batches: { $size: 0 } }] }).sort({ date: 1 }).lean(),
  ])
  // class average per assessment, for context (no other student's marks are exposed)
  const avgs = new Map((await AssessmentResult.aggregate<{ _id: unknown; avg: number }>([{ $match: { assessment: { $in: results.map(r => r.assessment) }, marks: { $ne: null } } }, { $group: { _id: '$assessment', avg: { $avg: '$marks' } } }])).map(a => [String(a._id), a.avg]))
  return (
    <>
      <PageHeader title="My Assessments" />
      <Card title="Upcoming" className="mb-6" pad={false}>
        <Table head={['Assessment', 'Category', 'Date', 'Duration', 'Max marks']} empty={<Empty>No upcoming assessments.</Empty>}>
          {upcoming.map(a => <tr key={String(a._id)}><td className="td font-medium">{a.name}</td><td className="td text-muted">{a.category}</td><td className="td">{day(a.date)}</td><td className="td text-muted">{a.durationMin ? `${a.durationMin} min` : '—'}</td><td className="td tabular-nums">{a.maxMarks}</td></tr>)}
        </Table>
      </Card>
      <Card title="Results" pad={false}>
        <Table head={['Assessment', 'Category', 'Date', 'Marks', 'Score', 'Class average']} empty={<Empty>No results yet.</Empty>}>
          {[...results].reverse().map(r => {
            const avg = avgs.get(String(r.assessment))
            return <tr key={String(r.assessment)}><td className="td font-medium">{r.name}</td><td className="td text-muted">{r.category}</td><td className="td text-muted">{day(r.date)}</td><td className="td tabular-nums">{r.marks == null ? <Badge>Absent</Badge> : `${r.marks} / ${r.max}`}</td><td className="td"><Score value={r.marks == null ? null : (r.marks / r.max) * 100} /></td><td className="td text-muted tabular-nums">{avg == null ? '—' : `${Math.round((avg / r.max) * 100)}%`}</td></tr>
          })}
        </Table>
      </Card>
    </>
  )
}
