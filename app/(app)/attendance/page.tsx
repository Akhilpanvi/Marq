import Link from 'next/link'
import { Types } from 'mongoose'
import { Download } from 'lucide-react'
import { can, requirePage, scopedStudentIds } from '@/lib/auth'
import { batchOptions } from '@/lib/options'
import { visibleBatches } from '@/lib/scope'
import { day, pct } from '@/lib/format'
import { attendancePct } from '@/lib/scoring'
import { Attendance, Batch, Student, TrainingSession, User } from '@/models'
import { Badge, Card, Grid, PageHeader, Score, Stat, Table } from '@/components/ui'
import { Filters, Select, sp } from '@/components/list'
import { Bars } from '@/components/charts'

export const metadata = { title: 'Attendance' }
type C = { present?: number; absent?: number; late?: number; excused?: number }

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('attendance.view')
  const params = await searchParams
  const batch = sp(params, 'batch'), from = sp(params, 'from'), to = sp(params, 'to'), view = sp(params, 'view') || 'students'
  const ids = await scopedStudentIds(me)
  const match: Record<string, unknown> = {}
  if (ids) match.student = { $in: ids }
  if (from || to) match.date = { ...(from ? { $gte: new Date(`${from}T00:00:00+05:30`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59+05:30`) } : {}) }
  if (batch && Types.ObjectId.isValid(batch)) {
    const inBatch = await Student.find({ batch }).distinct('_id')
    match.student = { $in: ids ? inBatch.filter(i => ids.some(x => x.equals(i))) : inBatch }
  }
  const scope = await visibleBatches(me)
  const bOpts = (await batchOptions()).filter(([id]) => !scope || scope.some(b => String(b) === id))

  const [byStudent, byMonth, bySession, corrections] = await Promise.all([
    Attendance.aggregate<{ _id: { s: Types.ObjectId; st: string }; n: number }>([{ $match: match }, { $group: { _id: { s: '$student', st: '$status' }, n: { $sum: 1 } } }]),
    Attendance.aggregate<{ _id: { m: string; st: string }; n: number }>([{ $match: match }, { $group: { _id: { m: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'Asia/Kolkata' } }, st: '$status' }, n: { $sum: 1 } } }]),
    Attendance.aggregate<{ _id: { s: Types.ObjectId; st: string }; n: number }>([{ $match: match }, { $group: { _id: { s: '$session', st: '$status' }, n: { $sum: 1 } } }]),
    Attendance.find({ ...match, 'history.0': { $exists: true } }).sort({ updatedAt: -1 }).limit(15).lean(),
  ])
  const per = new Map<string, C>()
  for (const r of byStudent) per.set(String(r._id.s), { ...per.get(String(r._id.s)), [r._id.st]: r.n })
  const students = await Student.find({ _id: { $in: [...per.keys(), ...corrections.map(c => c.student)] } }).select('name regNo batch').lean()
  const sInfo = new Map(students.map(s => [String(s._id), s]))
  const totals = byStudent.reduce<C>((t, r) => ({ ...t, [r._id.st]: (t[r._id.st as keyof C] ?? 0) + r.n }), {})
  const overall = attendancePct(totals)

  const months = new Map<string, Record<string, number | string>>()
  for (const r of byMonth) months.set(r._id.m, { month: r._id.m, ...months.get(r._id.m), [r._id.st]: r.n })
  const monthRows = [...months.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))).map(m => ({ ...m, pct: Math.round(attendancePct(m as C) ?? 0) }))

  const sessAgg = new Map<string, C>()
  for (const r of bySession) sessAgg.set(String(r._id.s), { ...sessAgg.get(String(r._id.s)), [r._id.st]: r.n })
  const sessions = await TrainingSession.find({ _id: { $in: [...sessAgg.keys()].map(k => new Types.ObjectId(k)) } }).select('title date batch').sort({ date: -1 }).limit(50).lean()
  const batches = await Batch.find(scope ? { _id: { $in: scope } } : {}).select('name').lean()
  const bName = new Map(batches.map(b => [String(b._id), b.name]))
  const batchAgg = new Map<string, C>()
  for (const [sid, c] of per) {
    const b = String(sInfo.get(sid)?.batch ?? 'none')
    const cur = batchAgg.get(b) ?? {}
    batchAgg.set(b, Object.fromEntries((['present', 'absent', 'late', 'excused'] as const).map(k => [k, (cur[k] ?? 0) + (c[k] ?? 0)])))
  }
  const editors = await User.find({ _id: { $in: corrections.flatMap(c => c.history.flatMap(h => (h.by ? [h.by] : []))) } }).select('name').lean()
  const eName = new Map(editors.map(e => [String(e._id), e.name]))
  const rows = [...per].map(([id, c]) => ({ id, s: sInfo.get(id), c, p: attendancePct(c) })).sort((a, b) => (a.p ?? 101) - (b.p ?? 101))
  const qs = new URLSearchParams(Object.entries(params).filter(([k]) => k !== 'view'))
  const tab = (v: string, label: string) => <Link href={`/attendance?${qs}&view=${v}`} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg'}`}>{label}</Link>

  return (
    <>
      <PageHeader title="Attendance" description="Present and late count as attended; excused sessions are left out of the percentage.">
        <Link className="btn-primary" href="/attendance/register">Daily Register</Link>
        <a className="btn-outline" href="/api/attendance/consolidated?format=xlsx"><Download className="size-4" />Consolidated Excel</a>
        {can(me, 'reports.export') && <a className="btn-outline" href={`/api/reports/attendance?format=xlsx&${qs}`}><Download className="size-4" />Export</a>}
      </PageHeader>
      <Grid>
        <Stat label="Overall attendance" value={pct(overall)} />
        <Stat label="Present" value={totals.present ?? 0} />
        <Stat label="Late" value={totals.late ?? 0} />
        <Stat label="Absent" value={totals.absent ?? 0} hint={`${totals.excused ?? 0} excused`} />
      </Grid>
      <Card title="Monthly attendance" className="my-6">
        <Bars data={monthRows} x="month" stacked series={[{ key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'excused', label: 'Excused' }, { key: 'late', label: 'Late' }]} />
      </Card>
      <Card pad={false}>
        <Filters params={params} q={false}>
          <input type="hidden" name="view" value={view} />
          <Select name="batch" value={batch} options={bOpts} all="All batches" />
          <label className="flex items-center gap-1 text-sm text-muted">From <input type="date" name="from" defaultValue={from} className="input w-auto" /></label>
          <label className="flex items-center gap-1 text-sm text-muted">To <input type="date" name="to" defaultValue={to} className="input w-auto" /></label>
        </Filters>
        <div className="flex gap-1 border-b border-line p-2">{tab('students', 'Student-wise')}{tab('batches', 'Batch-wise')}{tab('sessions', 'Session-wise')}{tab('corrections', 'Corrections')}</div>
        {view === 'students' && (
          <Table head={['Student', 'Batch', 'Present', 'Late', 'Absent', 'Excused', 'Attendance']}>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="td"><Link href={`/students/${r.id}`} className="font-medium hover:underline">{r.s?.name}</Link><div className="font-mono text-xs text-muted">{r.s?.regNo}</div></td>
                <td className="td">{bName.get(String(r.s?.batch)) ?? '—'}</td>
                {(['present', 'late', 'absent', 'excused'] as const).map(k => <td key={k} className="td tabular-nums">{r.c[k] ?? 0}</td>)}
                <td className="td"><Score value={r.p} /></td>
              </tr>
            ))}
          </Table>
        )}
        {view === 'batches' && (
          <Table head={['Batch', 'Present', 'Late', 'Absent', 'Excused', 'Attendance']}>
            {[...batchAgg].map(([b, c]) => (
              <tr key={b}><td className="td font-medium">{bName.get(b) ?? 'Unassigned'}</td>{(['present', 'late', 'absent', 'excused'] as const).map(k => <td key={k} className="td tabular-nums">{c[k] ?? 0}</td>)}<td className="td"><Score value={attendancePct(c)} /></td></tr>
            ))}
          </Table>
        )}
        {view === 'sessions' && (
          <Table head={['Session', 'Batch', 'Date', 'Present', 'Late', 'Absent', 'Excused', 'Attendance']}>
            {sessions.map(s => {
              const c = sessAgg.get(String(s._id)) ?? {}
              return <tr key={String(s._id)}><td className="td"><Link href={`/training/sessions/${s._id}`} className="font-medium hover:underline">{s.title}</Link></td><td className="td">{bName.get(String(s.batch)) ?? '—'}</td><td className="td text-muted">{day(s.date)}</td>{(['present', 'late', 'absent', 'excused'] as const).map(k => <td key={k} className="td tabular-nums">{c[k] ?? 0}</td>)}<td className="td"><Score value={attendancePct(c)} /></td></tr>
            })}
          </Table>
        )}
        {view === 'corrections' && (
          <Table head={['Student', 'Date', 'Change', 'By', 'Reason']}>
            {corrections.flatMap(c => c.history.map((h, i) => (
              <tr key={`${c._id}-${i}`}><td className="td">{sInfo.get(String(c.student))?.name}</td><td className="td text-muted">{day(h.at)}</td><td className="td"><Badge>{h.from}</Badge> → <Badge tone="blue">{h.to}</Badge></td><td className="td">{eName.get(String(h.by))}</td><td className="td text-muted">{h.reason}</td></tr>
            )))}
          </Table>
        )}
      </Card>
    </>
  )
}
