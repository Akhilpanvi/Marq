import Link from 'next/link'
import { Download, Lock } from 'lucide-react'
import { can, requirePage, scopedStudentIds } from '@/lib/auth'
import { visibleBatches } from '@/lib/scope'
import { dayRows, loadRegisters, STUDENT_COLS } from '@/lib/register'
import { span, type Period } from '@/lib/periods'
import { dayTime } from '@/lib/format'
import { Batch, DailyRegister, Student, User } from '@/models'
import { Badge, Card, Empty, Field, PageHeader, Table } from '@/components/ui'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { RegisterEditor } from '@/components/register-editor'
import { RegisterBulk } from '@/components/register-bulk'
import { decideChange, markExcused, requestChange } from '@/app/actions/register'

export const metadata = { title: 'Daily Register' }
const DAY = /^\d{4}-\d{2}-\d{2}$/

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ day?: string; batch?: string }> }) {
  const me = await requirePage('attendance.view')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const { day: d, batch: b } = await searchParams
  const day = DAY.test(d ?? '') ? d! : today
  const scopeB = await visibleBatches(me)
  const batches = await Batch.find(scopeB ? { _id: { $in: scopeB } } : {}).select('name').sort({ name: 1 }).lean()
  const batch = batches.find(x => String(x._id) === b) ?? null
  const bName = new Map(batches.map(x => [String(x._id), x.name]))
  const counts = new Map((await Student.aggregate<{ _id: unknown; n: number }>([{ $match: { status: 'active', batch: { $in: batches.map(x => x._id) } } }, { $group: { _id: '$batch', n: { $sum: 1 } } }])).map(c => [String(c._id), c.n]))
  const noBatch = await Student.countDocuments({ status: 'active', $or: [{ batch: null }, { batch: { $exists: false } }] })
  const [reg, recent, pendingAll] = await Promise.all([
    batch ? DailyRegister.findOne({ day, batch: batch._id }).lean() : null,
    DailyRegister.find(batch ? { batch: batch._id } : { batch: { $in: batches.map(x => x._id) } }).select('day batch absences students requests.status').sort({ day: -1 }).limit(14).lean(),
    can(me, 'attendance.approve') ? DailyRegister.find({ 'requests.status': 'pending' }).select('day batch').lean() : [],
  ])
  const canPost = can(me, 'attendance.create')
  const canApprove = can(me, 'attendance.approve')
  const active = canPost && batch ? await Student.find({ status: 'active', batch: batch._id }).select('regNo name department specialization').sort({ regNo: 1 }).lean() : []
  const roster = active.map(s => ({ id: String(s._id), regNo: s.regNo, name: s.name, department: s.department ?? '', specialization: s.specialization ?? '' }))
  const qs = (x: { day?: string; batch?: unknown }) => `/attendance/register?day=${x.day ?? day}${x.batch ? `&batch=${x.batch}` : ''}`
  const bq = batch ? `&batch=${batch._id}` : ''

  return (
    <>
      <PageHeader title="Daily Register" description="Period-wise attendance in the college sheet format. Choose the batch, then post the day — each batch’s register is locked once posted." back={{ href: '/attendance', label: 'Attendance' }}>
        <form className="flex flex-wrap items-center gap-2">
          <select name="batch" defaultValue={batch ? String(batch._id) : ''} className="input w-auto" aria-label="Batch"><option value="">Choose batch…</option>{batches.map(x => <option key={String(x._id)} value={String(x._id)}>{x.name}</option>)}</select>
          <input type="date" name="day" defaultValue={day} max={today} className="input w-auto" aria-label="Date" />
          <button className="btn-outline">Open</button>
        </form>
        <a className="btn-outline" href={`/api/attendance/consolidated?format=xlsx${bq}`}><Download className="size-4" />Consolidated Excel</a>
        <a className="btn-ghost" href={`/api/attendance/consolidated?format=csv${bq}`}>CSV</a>
      </PageHeader>

      {canApprove && pendingAll.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Changes waiting for your approval on: {pendingAll.map(r => <Link key={String(r._id)} href={qs(r)} className="ml-2 font-medium text-accent hover:underline">{r.day.split('-').reverse().join('.')}{r.batch ? ` · ${bName.get(String(r.batch)) ?? ''}` : ''}</Link>)}
        </div>
      )}

      {!batch ? (
        <Card title="Which batch are you marking attendance for?">
          {batches.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {batches.map(x => (
                <Link key={String(x._id)} href={qs({ batch: x._id })} className="rounded-xl border border-line p-4 transition hover:border-accent hover:bg-accent-soft">
                  <div className="font-semibold">{x.name}</div>
                  <div className="text-sm text-muted">{counts.get(String(x._id)) ?? 0} active students</div>
                </Link>
              ))}
            </div>
          ) : <Empty>No batches yet. Create one under <Link href="/training" className="text-accent hover:underline">Training</Link> (for example “A”), then assign students to it from Students.</Empty>}
          {noBatch > 0 && <p className="mt-4 text-sm text-amber-600">{noBatch} active student{noBatch === 1 ? ' has' : 's have'} no batch and can’t be marked. Assign them under <Link href="/students" className="underline">Students</Link> → select → Batch.</p>}
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm">Batch <b>{batch.name}</b> · {counts.get(String(batch._id)) ?? 0} active students · <Link href="/attendance/register" className="text-accent hover:underline">change batch</Link></p>
          {canPost && (
            <details className="group mb-4">
              <summary className="btn-outline w-fit cursor-pointer list-none">Upload attendance — multiple files / dates</summary>
              <div className="mt-3"><RegisterBulk students={roster} maxDay={today} batch={String(batch._id)} batchName={batch.name} /></div>
            </details>
          )}
          {reg ? <Locked day={day} batchName={batch.name} reg={{ ...reg, periods: reg.periods as Period[] }} meId={String(me._id)} canPost={canPost} canApprove={canApprove} superadmin={me.perms.includes('*')} scope={await scopedStudentIds(me)} />
            : canPost ? (
              roster.length ? <RegisterEditor initialDay={day} maxDay={today} students={roster} batch={String(batch._id)} batchName={batch.name} /> : <Empty>Batch {batch.name} has no active students. Assign students to it under Students.</Empty>
            ) : <Empty>No register has been posted for {batch.name} on {day.split('-').reverse().join('.')}.</Empty>}
        </>
      )}

      <Card title="Recent registers" className="mt-6" pad={false}>
        <Table head={['Date', 'Batch', 'Students', 'Absent periods', 'Change requests', '']} empty={<Empty>No registers yet.</Empty>}>
          {recent.map(r => {
            const pending = r.requests.filter(x => x.status === 'pending').length
            const q = `day=${r.day}&batch=${r.batch}`
            return (
              <tr key={String(r._id)}>
                <td className="td font-medium"><Link href={qs(r)} className="hover:underline">{r.day.split('-').reverse().join('.')}</Link></td>
                <td className="td">{bName.get(String(r.batch)) ?? '—'}</td>
                <td className="td tabular-nums">{r.students}</td>
                <td className="td tabular-nums">{r.absences}</td>
                <td className="td">{pending ? <Badge tone="amber">{pending} pending</Badge> : <span className="text-muted">{r.requests.length || '—'}</span>}</td>
                <td className="td text-right"><a className="btn-ghost px-2 py-1 text-xs" href={`/api/attendance/day?${q}&format=xlsx`}>Excel</a><a className="btn-ghost px-2 py-1 text-xs" href={`/api/attendance/day?${q}&format=csv`}>CSV</a></td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </>
  )
}

async function Locked({ day, batchName, reg, meId, canPost, canApprove, superadmin, scope }: { day: string; batchName: string; reg: { _id: unknown; batch?: unknown; periods: Period[]; requests: { _id: unknown; student?: unknown; period?: number | null; from?: string | null; to?: string | null; reason?: string | null; byName?: string | null; by?: unknown; at?: Date | null; status?: string | null; decidedByName?: string | null }[]; submittedBy?: unknown; createdAt: Date }; meId: string; canPost: boolean; canApprove: boolean; superadmin: boolean; scope: Awaited<ReturnType<typeof scopedStudentIds>> }) {
  const data = await loadRegisters(day, day, scope, reg.batch as string)
  const { head, body, cols } = dayRows(day, reg.periods, data)
  const by = reg.submittedBy ? await User.findById(reg.submittedBy).select('name').lean() : null
  const sName = new Map(data.students.map(s => [String(s._id), `${s.name} (${s.regNo})`]))
  const absentees = body.filter(r => r.slice(STUDENT_COLS.length).includes('A')).length
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <Lock className="size-4 text-muted" />
        <span><b>{batchName}</b> · posted {by ? `by ${by.name}` : ''} on {dayTime(reg.createdAt)} · locked</span>
        <Badge tone={absentees ? 'red' : 'green'}>{absentees} absentee{absentees === 1 ? '' : 's'}</Badge>
        <div className="ml-auto flex gap-2">
          <a className="btn-outline py-1.5" href={`/api/attendance/day?day=${day}&batch=${reg.batch}&format=xlsx`}><Download className="size-4" />Excel</a>
          <a className="btn-ghost py-1.5" href={`/api/attendance/day?day=${day}&batch=${reg.batch}&format=csv`}>CSV</a>
          {canPost && (
            <Modal label="Request change" title={`Request a change · ${day.split('-').reverse().join('.')}`} className="btn-outline py-1.5">
              <ActionForm action={requestChange} submit="Send for Director approval">
                <input type="hidden" name="reg" value={String(reg._id)} />
                <Field label="Student"><select name="student" required className="input"><option value="">Choose…</option>{data.students.map(s => <option key={String(s._id)} value={String(s._id)}>{s.regNo} · {s.name}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Period"><select name="period" required className="input">{reg.periods.map(p => <option key={p.no} value={p.no}>{p.no} · {span(p)}</option>)}</select></Field>
                  <Field label="Change to"><select name="to" required className="input"><option value="present">Present</option><option value="absent">Absent</option></select></Field>
                </div>
                <Field label="Reason"><textarea name="reason" required minLength={5} rows={2} className="input" /></Field>
              </ActionForm>
            </Modal>
          )}
          {canApprove && (
            <Modal label="Mark excused" title={`Mark excused · ${day.split('-').reverse().join('.')}`} className="btn-outline py-1.5">
              <p className="mb-3 text-sm text-muted">Director only. Turns a student’s <b>absent</b> periods into <b>E — excused</b> (on duty, medical…). Excused periods are left out of the attendance percentage. Applied immediately and kept in the history.</p>
              <ActionForm action={markExcused} submit="Apply">
                <input type="hidden" name="reg" value={String(reg._id)} />
                <Field label="Student"><select name="student" required className="input"><option value="">Choose…</option>{data.students.map(s => <option key={String(s._id)} value={String(s._id)}>{s.regNo} · {s.name}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Period"><select name="period" required className="input"><option value="all">All absent periods</option>{reg.periods.map(p => <option key={p.no} value={p.no}>{p.no} · {span(p)}</option>)}</select></Field>
                  <Field label="Mark as"><select name="to" className="input"><option value="excused">Excused (E)</option><option value="absent">Undo — back to absent</option></select></Field>
                </div>
                <Field label="Reason"><input name="reason" required minLength={3} placeholder="On duty — hackathon / Medical leave" className="input" /></Field>
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
              <tr key={r[1]} className={r.includes('D') ? 'opacity-50' : ''} title={r.includes('D') ? 'Dropped' : undefined}>
                {r.map((v, i) => <td key={i} className={`td ${i >= STUDENT_COLS.length ? 'text-center' : ''} ${v === 'A' ? 'bg-red-500/15 font-semibold text-red-700 dark:text-red-300' : v === 'E' || v === 'D' ? 'bg-zinc-500/15 font-semibold text-muted' : ''} ${v === 'Lunch Break' ? 'text-xs text-muted' : ''} ${i === 1 ? 'font-mono text-xs' : ''}`}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
