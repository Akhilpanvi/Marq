'use server'
import { revalidatePath } from 'next/cache'
import { assertBatchAccess, audit, can, guard } from '@/lib/auth'
import { attempt, Invalid, oid, str, type State } from '@/lib/form'
import { readRawRows } from '@/lib/sheet'
import { parseRegister } from '@/lib/register-parse'
import { fixRegisterIndexes } from '@/lib/register'
import { span, type Period } from '@/lib/periods'
import { notifyUsers } from '@/lib/notify'
import { Attendance, Batch, DailyRegister, Role, Student, TrainingSession, User } from '@/models'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

/** Reads an uploaded register sheet; nothing is saved. The editor fills itself from the result. */
export async function readRegisterFile(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.create')
    const batch = await chosenBatch(me, fd)
    const file = fd.get('file')
    let parsed
    try {
      parsed = parseRegister(await readRawRows(file), file instanceof File ? file.name : '')
    } catch (e) {
      if (e instanceof Invalid) throw e
      throw new Invalid(`Couldn't read that sheet: ${(e as Error).message}`)
    }
    const known = new Set((await Student.find({ regNo: { $in: Object.keys(parsed.marks) }, batch: batch._id }).select('regNo').lean()).map(s => s.regNo))
    const unknown = Object.keys(parsed.marks).filter(r => !known.has(r)) // not MARQ students, or in another batch
    const posted = parsed.day ? !!(await DailyRegister.exists({ day: parsed.day, batch: batch._id })) : false
    return { ok: `Read ${Object.keys(parsed.marks).length} students${parsed.day ? ` for ${parsed.day.split('-').reverse().join('.')}` : ''}. Check the grid, then Verify.`, data: { ...parsed, unknown, posted } }
  })
}

type Submit = { day: string; batch: string; periods: Period[]; absent: Record<string, number[]> }

/** The batch the register is for — every register belongs to exactly one batch. */
async function chosenBatch(me: Awaited<ReturnType<typeof guard>>, src: FormData | string | undefined) {
  const id = typeof src === 'string' || src === undefined ? src : oid(src, 'batch')
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) throw new Invalid('Choose the batch you are marking attendance for.')
  const b = await Batch.findById(id).select('name').lean()
  if (!b) throw new Invalid('That batch no longer exists.')
  await assertBatchAccess(me, b._id)
  return b
}

/** Saves the day's register and locks it: one session per period, one attendance mark per student per period. */
export async function submitRegister(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.create')
    let body: Submit
    try {
      body = JSON.parse(str(fd, 'payload', 200_000))
    } catch {
      throw new Invalid('The register could not be read. Reload and try again.')
    }
    const { day, periods, absent } = body
    const batch = await chosenBatch(me, body.batch)
    await fixRegisterIndexes()
    if (!DAY.test(day ?? '')) throw new Invalid('Choose the attendance date.')
    if (day > today()) throw new Invalid('Attendance can’t be posted for a future date.')
    if (!Array.isArray(periods) || !periods.length || periods.length > 12) throw new Invalid('Choose at least one period.')
    for (const p of periods) if (!Number.isInteger(p.no) || !/^\d{2}:\d{2}$/.test(p.start) || !/^\d{2}:\d{2}$/.test(p.end) || p.end <= p.start) throw new Invalid(`Period ${p.no} needs a valid start and end time.`)
    if (new Set(periods.map(p => p.no)).size !== periods.length) throw new Invalid('Period numbers must be unique.')
    if (await DailyRegister.exists({ day, batch: batch._id })) throw new Invalid(`Attendance for ${batch.name} on ${day} has already been posted and is locked. Use “Request change”.`)

    const students = await Student.find({ status: 'active', batch: batch._id }).select('_id').lean()
    if (!students.length) throw new Invalid(`Batch ${batch.name} has no active students.`)
    const ids = new Set(students.map(s => String(s._id)))
    const absences = Object.entries(absent ?? {}).filter(([sid]) => ids.has(sid))
    const reg = await DailyRegister.create({ day, batch: batch._id, periods, students: students.length, absences: absences.reduce((t, [, ps]) => t + ps.length, 0), submittedBy: me._id }).catch(e => {
      if ((e as { code?: number }).code === 11000) throw new Invalid(`Attendance for ${batch.name} on ${day} was just posted by someone else and is locked.`)
      throw e
    })
    try {
      const sessions = await TrainingSession.insertMany(periods.map(p => ({
        title: `Period ${p.no} · ${span(p)}`, date: new Date(`${day}T${p.start}:00+05:30`), start: p.start, end: p.end, status: 'completed', register: reg._id, batch: batch._id, trainer: me._id,
      })))
      const absentSet = new Map(absences.map(([sid, ps]) => [sid, new Set(ps)]))
      await Attendance.insertMany(sessions.flatMap((s, i) => students.map(st => ({
        session: s._id, student: st._id, date: s.date, markedBy: me._id,
        status: absentSet.get(String(st._id))?.has(periods[i].no) ? 'absent' : 'present',
      }))), { ordered: false })
    } catch (e) {
      // keep it all-or-nothing: a half-written register would be locked with missing marks
      const sessions = await TrainingSession.find({ register: reg._id }).distinct('_id')
      await Attendance.deleteMany({ session: { $in: sessions } })
      await TrainingSession.deleteMany({ register: reg._id })
      await DailyRegister.deleteOne({ _id: reg._id })
      throw e
    }
    await audit(me, 'attendance', 'register.submit', `${day} · ${batch.name}`, undefined, { batch: batch._id, periods: periods.map(p => p.no), students: students.length, absences: reg.absences })
    revalidatePath('/attendance/register')
    return { ok: `Attendance for ${batch.name} · ${day.split('-').reverse().join('.')} saved and locked. Changes now need Director approval.` }
  })
}

async function approvers() {
  const roles = await Role.find({ $or: [{ perms: '*' }, { perms: 'attendance.approve' }] }).distinct('_id')
  return User.find({ role: { $in: roles }, status: 'active' }).distinct('_id')
}

export async function requestChange(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.create')
    const reg = await DailyRegister.findById(oid(fd, 'reg'))
    if (!reg) throw new Invalid('No register for that day.')
    const student = oid(fd, 'student')
    const period = Number(str(fd, 'period', 3))
    const to = str(fd, 'to', 10)
    const reason = str(fd, 'reason', 300)
    if (!student || !reg.periods.some(p => p.no === period)) throw new Invalid('Choose a student and a period.')
    if (to !== 'present' && to !== 'absent') throw new Invalid('Choose present or absent.')
    if (reason.length < 5) throw new Invalid('Give a reason for the change.')
    const session = await TrainingSession.findOne({ register: reg._id, start: reg.periods.find(p => p.no === period)!.start }).select('_id').lean()
    const mark = await Attendance.findOne({ session: session?._id, student }).select('status').lean()
    if (!mark) throw new Invalid('That student has no mark for this period.')
    if (mark.status === to) throw new Invalid(`Already marked ${to}.`)
    if (reg.requests.some(r => r.status === 'pending' && String(r.student) === student && r.period === period)) throw new Invalid('A change for this student and period is already waiting for approval.')
    reg.requests.push({ student, period, from: mark.status, to, reason, by: me._id, byName: me.name })
    await reg.save()
    await audit(me, 'attendance', 'register.changeRequest', reg.day, { status: mark.status }, { student, period, to, reason })
    await notifyUsers(await approvers(), { title: `Attendance change awaiting approval (${reg.day})`, body: `${me.name}: period ${period} → ${to}. ${reason}`, link: `/attendance/register?day=${reg.day}${reg.batch ? `&batch=${reg.batch}` : ''}` })
    revalidatePath('/attendance/register')
    return { ok: 'Change requested. It applies once the Director approves it.' }
  })
}

export async function decideChange(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.approve')
    const id = oid(fd, 'id')
    if (!id) throw new Invalid('Request not found.')
    const reg = await DailyRegister.findOne({ 'requests._id': id })
    const r = reg?.requests.id(id)
    if (!reg || !r) throw new Invalid('Request not found.')
    if (r.status !== 'pending') throw new Invalid(`This request was already ${r.status}.`)
    if (String(r.by) === String(me._id) && !can(me, '*')) throw new Invalid('You can’t approve your own request.')
    const approve = fd.get('decision') === 'approve'
    if (approve) {
      const p = reg.periods.find(x => x.no === r.period)!
      const session = await TrainingSession.findOne({ register: reg._id, start: p.start }).select('_id').lean()
      await Attendance.updateOne(
        { session: session?._id, student: r.student },
        { $set: { status: r.to!, markedBy: me._id }, $push: { history: { from: r.from, to: r.to, by: me._id, at: new Date(), reason: `${r.reason} — requested by ${r.byName}, approved by ${me.name}` } } },
      )
    }
    r.status = approve ? 'approved' : 'rejected'
    r.decidedBy = me._id
    r.decidedByName = me.name
    r.decidedAt = new Date()
    await reg.save()
    await audit(me, 'attendance', approve ? 'register.changeApproved' : 'register.changeRejected', reg.day, { status: r.from }, { status: approve ? r.to : r.from, student: r.student, period: r.period })
    if (r.by) await notifyUsers([r.by], { title: `Attendance change ${r.status} (${reg.day})`, body: `Period ${r.period} → ${r.to}`, link: `/attendance/register?day=${reg.day}${reg.batch ? `&batch=${reg.batch}` : ''}` })
    revalidatePath('/attendance/register')
    return { ok: approve ? 'Approved and applied.' : 'Rejected.' }
  })
}

/** Director only: mark a posted day's periods Excused (on duty / medical) — or undo it. Applied at once, with history. */
export async function markExcused(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.approve')
    const reg = await DailyRegister.findById(oid(fd, 'reg')).lean()
    if (!reg) throw new Invalid('No register for that day.')
    const student = oid(fd, 'student')
    if (!student) throw new Invalid('Choose a student.')
    const which = str(fd, 'period', 3)
    const periods = which === 'all' ? reg.periods : reg.periods.filter(p => p.no === Number(which))
    if (!periods.length) throw new Invalid('Choose a period.')
    const undo = fd.get('to') === 'absent'
    const reason = str(fd, 'reason', 300)
    if (reason.length < 3) throw new Invalid('Give the reason (e.g. on duty, medical).')
    const sessions = await TrainingSession.find({ register: reg._id, start: { $in: periods.flatMap(p => (p.start ? [p.start] : [])) } }).distinct('_id')
    const from = undo ? 'excused' : 'absent', to = undo ? 'absent' : 'excused'
    const marks = await Attendance.find({ session: { $in: sessions }, student, status: from }).select('_id').lean()
    if (!marks.length) throw new Invalid(undo ? 'No excused periods to undo for this student and period.' : 'Only absent periods can be excused — this student was not absent then.')
    await Attendance.updateMany(
      { _id: { $in: marks.map(m => m._id) } },
      { $set: { status: to, markedBy: me._id }, $push: { history: { from, to, by: me._id, at: new Date(), reason: `${undo ? 'Excused removed' : 'Excused'} by ${me.name}: ${reason}` } } },
    )
    await audit(me, 'attendance', undo ? 'register.excuseRemoved' : 'register.excused', reg.day, { status: from }, { status: to, student, periods: which, reason })
    revalidatePath('/attendance/register')
    return { ok: `${marks.length} period${marks.length === 1 ? '' : 's'} marked ${to}.` }
  })
}
