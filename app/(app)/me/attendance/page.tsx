import { requireStudent } from '@/lib/auth'
import { journey } from '@/lib/journey'
import { day, pct } from '@/lib/format'
import { Student } from '@/models'
import { Badge, Card, Grid, PageHeader, Stat, Table, Empty } from '@/components/ui'
import { AttendanceDays } from '@/components/attendance-days'

export const metadata = { title: 'My Attendance' }
const TONE = { present: 'green', late: 'amber', absent: 'red', excused: 'zinc' } as const

export default async function MyAttendance() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('batch').lean()
  const j = await journey(me.student, s?.batch)
  const c = (k: keyof typeof TONE) => j.attendance.filter(a => a.status === k).length
  return (
    <>
      <PageHeader title="My Attendance" description="Present and late count as attended; excused sessions are not counted." />
      <Grid><Stat label="Attendance" value={pct(j.p.dims.attendance)} /><Stat label="Present" value={c('present')} /><Stat label="Late" value={c('late')} /><Stat label="Absent" value={c('absent')} hint={`${c('excused')} excused`} /></Grid>
      <Card title="Day-wise attendance" className="my-6"><AttendanceDays days={j.attendanceDays} /></Card>
      <Card title="Session history" pad={false}>
        <Table head={['Session', 'Date', 'Status']} empty={<Empty>No attendance recorded yet.</Empty>}>
          {j.attendance.map(a => <tr key={String(a._id)}><td className="td">{(a.session as unknown as { title?: string })?.title ?? '—'}</td><td className="td text-muted">{day(a.date)}</td><td className="td"><Badge tone={TONE[a.status]}>{a.status}</Badge>{a.history.length > 0 && <span className="ml-2 text-xs text-muted">corrected: {a.history.at(-1)?.reason}</span>}</td></tr>)}
        </Table>
      </Card>
    </>
  )
}
