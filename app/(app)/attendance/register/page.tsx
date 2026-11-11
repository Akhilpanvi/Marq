import Link from 'next/link'
import { Download, Lock } from 'lucide-react'
import { can, requirePage, scopedStudentIds } from '@/lib/auth'
import { dayRows, loadRegisters, STUDENT_COLS } from '@/lib/register'
import { span, type Period } from '@/lib/periods'
import { dayTime } from '@/lib/format'
import { DailyRegister, Student, User } from '@/models'
import { Badge, Card, Empty, Field, PageHeader, Table } from '@/components/ui'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { RegisterEditor } from '@/components/register-editor'
import { RegisterBulk } from '@/components/register-bulk'
import { decideChange, requestChange } from '@/app/actions/register'

export const metadata = { title: 'Daily Register' }
const DAY = /^\d{4}-\d{2}-\d{2}$/

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const me = await requirePage('attendance.view')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const { day: d } = await searchParams
  const day = DAY.test(d ?? '') ? d! : today
  const [reg, recent, pendingAll] = await Promise.all([
    DailyRegister.findOne({ day }).lean(),
    DailyRegister.find().select('day absences students requests.status').sort({ day: -1 }).limit(14).lean(),
    can(me, 'attendance.approve') ? DailyRegister.find({ 'requests.status': 'pending' }).select('day').lean() : [],
  ])
  const canPost = can(me, 'attendance.create')
  const canApprove = can(me, 'attendance.approve')
  const active = canPost ? await Student.find({ status: 'active' }).select('regNo name department specialization').sort({ regNo: 1 }).lean() : []
  const roster = active.map(s => ({ id: String(s._id), regNo: s.regNo, name: s.name, department: s.department ?? '', specialization: s.specialization ?? '' }))

  return (
    <>
      <PageHeader title="Daily Register" description="Period-wise attendance for the whole cohort, in the college sheet format. Posted once per day, then locked." back={{ href: '/attendance', label: 'Attendance' }}>
        <form className="flex items-center gap-2"><input type="date" name="day" defaultValue={day} max={today} className="input w-auto" aria-label="Date" /><button className="btn-outline">Open</button></form>
        <a className="btn-outline" href="/api/attendance/consolidated?format=xlsx"><Download className="size-4" />Consolidated Excel</a>
        <a className="btn-ghost" href="/api/attendance/consolidated?format=csv">CSV</a>
      </PageHeader>

      {canApprove && pendingAll.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Changes waiting for your approval on: {pendingAll.map(r => <Link key={r.day} href={`/attendance/register?day=${r.day}`} className="ml-2 font-medium text-accent hover:underline">{r.day.split('-').reverse().join('.')}</Link>)}
        </div>
      )}

      {canPost && (
        <details className="group mb-4">
          <summary className="btn-outline w-fit cursor-pointer list-none">Upload attendance — multiple files / dates</summary>
          <div className="mt-3"><RegisterBulk students={roster} maxDay={today} /></div>
        </details>
      )}

      {reg ? <Locked day={day} reg={{ ...reg, periods: reg.periods as Period[] }} meId={String(me._id)} canPost={canPost} canApprove={canApprove} superadmin={me.perms.includes('*')} scope={await scopedStudentIds(me)} />
        : canPost ? (
          <RegisterEditor initialDay={day} maxDay={today} students={roster} />
        ) : <Empty>No register has been posted for {day.split('-').reverse().join('.')}.</Empty>}

      <Card title="Recent registers" className="mt-6" pad={false}>
        <Table head={['Date', 'Students', 'Absent periods', 'Change requests', '']} empty={<Empty>No registers yet.</Empty>}>
          {recent.map(r => {
            const pending = r.requests.filter(x => x.status === 'pending').length
            return (
              <tr key={r.day}>
                <td className="td font-medium"><Link href={`/attendance/register?day=${r.day}`} className="hover:underline">{r.day.split('-').reverse().join('.')}</Link></td>
                <td className="td tabular-nums">{r.students}</td>
                <td className="td tabular-nums">{r.absences}</td>
                <td className="td">{pending ? <Badge tone="amber">{pending} pending</Badge> : <span className="text-muted">{r.requests.length || '—'}</span>}</td>
                <td className="td text-right"><a className="btn-ghost px-2 py-1 text-xs" href={`/api/attendance/day?day=${r.day}&format=xlsx`}>Excel</a><a className="btn-ghost px-2 py-1 text-xs" href={`/api/attendance/day?day=${r.day}&format=csv`}>CSV</a></td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </>
  )
}

async function Locked({ day, reg, meId, canPost, canApprove, superadmin, scope }: { day: string; reg: { periods: Period[]; requests: { _id: unknown; student?: unknown; period?: number | null; from?: string | null; to?: string | null; reason?: string | null; byName?: string | null; by?: unknown; at?: Date | null; status?: string | null; decidedByName?: string | null }[]; submittedBy?: unknown; createdAt: Date }; meId: string; canPost: boolean; canApprove: boolean; superadmin: boolean; scope: Awaited<ReturnType<typeof scopedStudentIds>> }) {
  const data = await loadRegisters(day, day, scope)
  const { head, body, cols } = dayRows(day, reg.periods, data)
  const by = reg.submittedBy ? await User.findById(reg.submittedBy).select('name').lean() : null
  const sName = new Map(data.students.map(s => [String(s._id), `${s.name} (${s.regNo})`]))
  const absentees = body.filter(r => r.slice(STUDENT_COLS.length).includes('A')).length
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <Lock className="size-4 text-muted" />
        <span>Posted {by ? `by ${by.name}` : ''} on {dayTime(reg.createdAt)} · locked</span>
        <Badge tone={absentees ? 'red' : 'green'}>{absentees} absentee{absentees === 1 ? '' : 's'}</Badge>
        <div className="ml-auto flex gap-2">
          <a className="btn-outline py-1.5" href={`/api/attendance/day?day=${day}&format=xlsx`}><Download className="size-4" />Excel</a>
          <a className="btn-ghost py-1.5" href={`/api/attendance/day?day=${day}&format=csv`}>CSV</a>
          {canPost && (
            <Modal label="Request change" title={`Request a change · ${day.split('-').reverse().join('.')}`} className="btn-outline py-1.5">
              <ActionForm action={requestChange} submit="Send for Director approval">
                <input type="hidden" name="day" value={day} />
                <Field label="Student"><select name="student" required className="input"><option value="">Choose…</option>{data.students.map(s => <option key={String(s._id)} value={String(s._id)}>{s.regNo} · {s.name}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Period"><select name="period" required className="input">{reg.periods.map(p => <option key={p.no} value={p.no}>{p.no} · {span(p)}</option>)}</select></Field>
                  <Field label="Change to"><select name="to" required className="input"><option value="present">Present</option><option value="absent">Absent</option></select></Field>
                </div>
                <Field label="Reason"><textarea name="reason" required minLength={5} rows={2} className="input" /></Field>
              </ActionForm>
            </Modal>
          )}
        </div>
      </div>

      {reg.requests.length > 0 && (
        <Card title="Change requests" className="mb-4" pad={false}>
          <Table head={['Student', 'Period', 'Change', 'Reason', 'Requested', 'Status', '']}>
            {[...reg.requests].reverse().map(r => (
              <tr key={String(r._id)}>
                <td className="td">{sName.get(String(r.student)) ?? '—'}</td>
                <td className="td tabular-nums">{r.period}</td>
                <td className="td">{r.from} → <b>{r.to}</b></td>
                <td className="td max-w-64 text-muted">{r.reason}</td>
                <td className="td text-xs text-muted">{r.byName}<div>{dayTime(r.at)}</div></td>
                <td className="td"><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}>{r.status}</Badge>{r.decidedByName && <div className="text-xs text-muted">by {r.decidedByName}</div>}</td>
                <td className="td text-right">{canApprove && r.status === 'pending' && (String(r.by) !== meId || superadmin) && (
                  <div className="flex justify-end gap-1">
                    <ActionButton action={decideChange} fields={{ id: String(r._id), decision: 'approve' }} className="btn-ghost px-2 py-1 text-xs text-emerald-600">Approve</ActionButton>
                    <ActionButton action={decideChange} fields={{ id: String(r._id), decision: 'reject' }} className="btn-ghost px-2 py-1 text-xs text-red-600">Reject</ActionButton>
                  </div>
                )}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line bg-subtle/70">
            <tr>{head[0].slice(0, STUDENT_COLS.length).map(h => <th key={h} rowSpan={3} className="th border-r border-line">{h}</th>)}{cols.map((c, i) => <th key={i} className="th text-center">{c.kind === 'period' ? c.p.no : ''}</th>)}</tr>
            <tr>{cols.map((c, i) => <th key={i} className="px-2 text-center text-[11px] font-normal text-muted">{c.kind === 'period' ? span(c.p) : span(c)}</th>)}</tr>
            <tr><th colSpan={cols.length} className="px-2 pb-2 text-center text-xs font-semibold">{day.split('-').reverse().join('.')}</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {body.map(r => (
              <tr key={r[1]}>
                {r.map((v, i) => <td key={i} className={`td ${i >= STUDENT_COLS.length ? 'text-center' : ''} ${v === 'A' ? 'bg-red-500/15 font-semibold text-red-700 dark:text-red-300' : ''} ${v === 'Lunch Break' ? 'text-xs text-muted' : ''} ${i === 1 ? 'font-mono text-xs' : ''}`}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
