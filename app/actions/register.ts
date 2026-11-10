'use server'
import { revalidatePath } from 'next/cache'
import { audit, can, guard } from '@/lib/auth'
import { attempt, Invalid, oid, str, type State } from '@/lib/form'
import { readRawRows } from '@/lib/sheet'
import { parseRegister } from '@/lib/register-parse'
import { span, type Period } from '@/lib/periods'
import { notifyUsers } from '@/lib/notify'
import { Attendance, DailyRegister, Role, Student, TrainingSession, User } from '@/models'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

/** Reads an uploaded register sheet; nothing is saved. The editor fills itself from the result. */
export async function readRegisterFile(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    await guard('attendance.create')
    const file = fd.get('file')
    let parsed
    try {
      parsed = parseRegister(await readRawRows(file), file instanceof File ? file.name : '')
    } catch (e) {
      if (e instanceof Invalid) throw e
      throw new Invalid(`Couldn't read that sheet: ${(e as Error).message}`)
    }
    const known = new Set((await Student.find({ regNo: { $in: Object.keys(parsed.marks) } }).select('regNo').lean()).map(s => s.regNo))
    const unknown = Object.keys(parsed.marks).filter(r => !known.has(r))
    return { ok: `Read ${Object.keys(parsed.marks).length} students${parsed.day ? ` for ${parsed.day.split('-').reverse().join('.')}` : ''}. Check the grid, then Verify.`, data: { ...parsed, unknown } }
  })
}

type Submit = { day: string; periods: Period[]; absent: Record<string, number[]> }

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
    if (!DAY.test(day ?? '')) throw new Invalid('Choose the attendance date.')
    if (day > today()) throw new Invalid('Attendance can’t be posted for a future date.')
    if (!Array.isArray(periods) || !periods.length || periods.length > 12) throw new Invalid('Choose at least one period.')
    for (const p of periods) if (!Number.isInteger(p.no) || !/^\d{2}:\d{2}$/.test(p.start) || !/^\d{2}:\d{2}$/.test(p.end) || p.end <= p.start) throw new Invalid(`Period ${p.no} needs a valid start and end time.`)
    if (new Set(periods.map(p => p.no)).size !== periods.length) throw new Invalid('Period numbers must be unique.')
    if (await DailyRegister.exists({ day })) throw new Invalid(`Attendance for ${day} has already been posted and is locked. Use “Request change”.`)

    const students = await Student.find({ status: 'active' }).select('_id').lean()
    if (!students.length) throw new Invalid('There are no active students.')
    const ids = new Set(students.map(s => String(s._id)))
    const absences = Object.entries(absent ?? {}).filter(([sid]) => ids.has(sid))
    const reg = await DailyRegister.create({ day, periods, students: students.length, absences: absences.reduce((t, [, ps]) => t + ps.length, 0), submittedBy: me._id }).catch(e => {
      if ((e as { code?: number }).code === 11000) throw new Invalid(`Attendance for ${day} was just posted by someone else and is locked.`)
      throw e
    })
    try {
      const sessions = await TrainingSession.insertMany(periods.map(p => ({
        title: `Period ${p.no} · ${span(p)}`, date: new Date(`${day}T${p.start}:00+05:30`), start: p.start, end: p.end, status: 'completed', register: reg._id, trainer: me._id,
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
    await audit(me, 'attendance', 'register.submit', day, undefined, { periods: periods.map(p => p.no), students: students.length, absences: reg.absences })
    revalidatePath('/attendance/register')
    return { ok: `Attendance for ${day.split('-').reverse().join('.')} saved and locked. Changes now need Director approval.` }
  })
}

async function approvers() {
  const roles = await Role.find({ $or: [{ perms: '*' }, { perms: 'attendance.approve' }] }).distinct('_id')
  return User.find({ role: { $in: roles }, status: 'active' }).distinct('_id')
}

export async function requestChange(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.create')
    const reg = await DailyRegister.findOne({ day: str(fd, 'day', 10) })
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
    await notifyUsers(await approvers(), { title: `Attendance change awaiting approval (${reg.day})`, body: `${me.name}: period ${period} → ${to}. ${reason}`, link: `/attendance/register?day=${reg.day}` })
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
    if (r.by) await notifyUsers([r.by], { title: `Attendance change ${r.status} (${reg.day})`, body: `Period ${r.period} → ${r.to}`, link: `/attendance/register?day=${reg.day}` })
    revalidatePath('/attendance/register')
    return { ok: approve ? 'Approved and applied.' : 'Rejected.' }
  })
}
