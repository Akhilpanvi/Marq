'use server'
import { revalidatePath } from 'next/cache'
import { assertStudentAccess, audit, guard, studentScope } from '@/lib/auth'
import { mailEnabled } from '@/lib/mail'
import type { Types } from 'mongoose'
import { attempt, EMAIL, Invalid, need, oid, oids, oneOf, photoLink, REGNO, str, type State } from '@/lib/form'
import { normalise, readRawRows } from '@/lib/sheet'
import { issueLink } from '@/lib/tokens'
import { hasPerm } from '@/lib/rbac'
import { Application, Attendance, AssessmentResult, Batch, CodingStat, Evaluation, Notification, Program, Role, ScoreSnapshot, Student, User } from '@/models'

const STATUSES = ['active', 'on_hold', 'withdrawn', 'completed'] as const

export async function saveStudent(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'students.edit' : 'students.create')
    const regNo = need(fd, 'regNo', 'Registration number', 20).toUpperCase()
    if (!REGNO.test(regNo)) throw new Invalid('Registration number may only contain letters, digits and hyphens.')
    const email = need(fd, 'email', 'University email', 120).toLowerCase()
    if (!EMAIL.test(email)) throw new Invalid('Enter a valid university email.')
    const personalEmail = str(fd, 'personalEmail', 120).toLowerCase()
    if (personalEmail && !EMAIL.test(personalEmail)) throw new Invalid('Enter a valid placement mail ID.')
    const set: Record<string, unknown> = {
      regNo, email, personalEmail: personalEmail || undefined,
      name: need(fd, 'name', 'Full name', 120),
      phone: str(fd, 'phone', 20), department: str(fd, 'department', 80), specialization: str(fd, 'specialization', 80),
      year: str(fd, 'year', 20), section: str(fd, 'section', 20),
      batch: oid(fd, 'batch') ?? null, mentor: oid(fd, 'mentor') ?? null,
      status: oneOf(fd, 'status', STATUSES, 'active'),
    }
    set.photoUrl = photoLink(fd)
    if (id) {
      const before = await Student.findById(id).lean()
      if (!before) throw new Invalid('Student not found.')
      if (before?.status === 'dropped') delete set.status // only the Director's "Undo dropped" brings a dropped student back
      await Student.updateOne({ _id: id }, { $set: set })
      await audit(me, 'students', 'student.update', id, before, set)
      revalidatePath(`/students/${id}`)
    } else {
      const s = await Student.create(set)
      await audit(me, 'students', 'student.create', s._id, undefined, { regNo, email })
    }
    revalidatePath('/students')
    return { ok: id ? 'Student updated.' : 'Student added.' }
  })
}

/** Permanently deletes a student and everything tied to them (login, attendance, marks, coding, applications, evaluations). */
export async function deleteStudent(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('students.delete')
    const id = oid(fd, 'id')
    if (!id) throw new Invalid('Student not found.')
    await assertStudentAccess(me, id)
    const s = await Student.findById(id).lean()
    if (!s) throw new Invalid('Student not found.')
    if (str(fd, 'confirm', 40).toUpperCase() !== s.regNo) throw new Invalid(`Type ${s.regNo} to confirm.`)
    const users = await User.find({ student: id }).distinct('_id')
    const [att, res, apps, evals, coding] = await Promise.all([
      Attendance.deleteMany({ student: id }), AssessmentResult.deleteMany({ student: id }), Application.deleteMany({ student: id }),
      Evaluation.deleteMany({ student: id }), CodingStat.deleteMany({ student: id }),
      ScoreSnapshot.deleteMany({ student: id }), Notification.deleteMany({ user: { $in: users } }),
    ])
    await User.deleteMany({ student: id })
    await Student.deleteOne({ _id: id })
    const removed = { accounts: users.length, attendance: att.deletedCount, results: res.deletedCount, applications: apps.deletedCount, evaluations: evals.deletedCount, coding: coding.deletedCount }
    await audit(me, 'students', 'student.delete', id, { regNo: s.regNo, name: s.name, email: s.email }, removed)
    revalidatePath('/students')
    return { ok: `${s.name} (${s.regNo}) and all their records were deleted.` }
  })
}

/** Bulk assignment of batch / mentor / status to the selected students. */
export async function bulkUpdate(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('students.edit')
    const ids = oids(fd, 'ids')
    if (!ids.length) throw new Invalid('Select at least one student.')
    const set: Record<string, unknown> = {}
    const batch = str(fd, 'batch', 24), mentor = str(fd, 'mentor', 24), status = str(fd, 'status', 20)
    if (batch) set.batch = batch === 'none' ? null : oid(fd, 'batch')
    if (mentor) set.mentor = mentor === 'none' ? null : oid(fd, 'mentor')
    if (status) set.status = oneOf(fd, 'status', STATUSES)
    if (!Object.keys(set).length) throw new Invalid('Choose a batch, mentor or status to apply.')
    const r = await Student.updateMany({ _id: { $in: ids }, ...(set.status ? { status: { $ne: 'dropped' } } : {}) }, { $set: set })
    await audit(me, 'students', 'student.bulkUpdate', `${ids.length} students`, undefined, { ids, ...set })
    revalidatePath('/students')
    return { ok: `Updated ${r.modifiedCount} student${r.modifiedCount === 1 ? '' : 's'}.` }
  })
}

/** Creates portal accounts (role Student, status Invited) for selected students who have none, and sends activation links. */
export async function createAccounts(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('users.create')
    const ids = oids(fd, 'ids')
    if (!ids.length) throw new Invalid('Select at least one student.')
    const role = await Role.findOne({ key: 'student' }).lean()
    if (!role) throw new Invalid('The Student role is missing. Run the seed script.')
    const students = await Student.find({ _id: { $in: ids } }).select('name email regNo').lean()
    const existing = new Set((await User.find({ student: { $in: ids } }).distinct('student')).map(String))
    const links: [string, string, string][] = []
    let created = 0, skipped = 0
    for (const s of students) {
      if (existing.has(String(s._id)) || (await User.exists({ email: s.email }))) {
        skipped++
        continue
      }
      const u = await User.create({ name: s.name, email: s.email, empId: undefined, type: 'student', role: role._id, student: s._id, status: 'invited', createdBy: me._id })
      const link = await issueLink(u, 'activate')
      if (link) links.push([s.regNo, s.email, link])
      created++
    }
    await audit(me, 'users', 'account.bulkCreate', `${created} students`, undefined, { created, skipped })
    revalidatePath('/students')
    revalidatePath('/users')
    return {
      ok: `Created ${created} account${created === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} that already had one` : ''}.${links.length ? ' Email is not configured — download the activation links.' : ' Activation emails sent.'}`,
      data: links.length ? { links } : undefined,
    }
  })
}

/* ───────────── Bulk import ───────────── */

const ALIASES = {
  regNo: ['registration number', 'reg no', 'regno', 'reg. no', 'registration no', 'student id', 'student id no', 'student id number', 'id no', 'id number', 'roll no', 'roll number'],
  name: ['full name', 'student name'],
  email: ['university email', 'college email', 'official email', 'email id', 'kl email', 'university mail id'],
  personalEmail: ['placement mail id', 'placement email', 'placement email id', 'personal email'],
  phone: ['mobile', 'mobile number', 'phone number', 'contact'],
  department: ['dept', 'branch', 'parent branch'],
  specialization: ['specialisation', 'stream'],
  year: ['academic year', 'yr'],
  section: ['sec'],
  batch: ['assigned batch', 'batch name'],
  mentor: ['mentor email', 'assigned mentor'],
  status: ['cohort status'],
}

export type ImportRow = { row: number; data: Record<string, string>; outcome: 'create' | 'update' | 'duplicate' | 'error' | 'skip'; errors: string[] }

/** The Top Notch roster uses "Parent Branch" (CSE) + "Branch" (CSE-H/AI&DS…): then Branch is the specialization. */
function importAliases(raw: Record<string, string>[]) {
  const heads = new Set(Object.keys(raw[0] ?? {}).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '')))
  if (!heads.has('parentbranch')) return ALIASES
  return { ...ALIASES, department: ['dept', 'parent branch'], specialization: [...ALIASES.specialization, 'branch'] }
}

/** University email defaults to <regno>@kluniversity.in when the sheet has no email column/value. */
const UNI_DOMAIN = 'kluniversity.in'

const canon = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
const REG_HEADS = new Set(['regNo', ...ALIASES.regNo].map(canon))

/** Rows keyed by heading, with their real sheet row numbers. The heading row is found (a title line above it is fine). */
async function readImport(file: FormDataEntryValue | null) {
  const grid = await readRawRows(file)
  const h = grid.slice(0, 15).findIndex(r => r.some(c => REG_HEADS.has(canon(c ?? ''))))
  if (h < 0) throw new Invalid('Couldn’t find the “Registration Number” (or “Student ID NO”) column heading in the first 15 rows.')
  const head = grid[h].map(c => (c ?? '').trim())
  return grid.slice(h + 1)
    .map((r, i) => ({ sheetRow: h + 2 + i, rec: Object.fromEntries(head.flatMap((c, j) => (c ? [[c, String(r[j] ?? '').trim()]] : []))) as Record<string, string> }))
    .filter(x => Object.values(x.rec).some(Boolean))
}

async function validateImport(fd: FormData) {
  const all = await readImport(fd.get('file'))
  const norm = normalise(all.map(x => x.rec), importAliases(all.map(x => x.rec)))
  // ignore lines with no ID, name or email (titles, "Total: 122" footers…) so they don't count as rows
  const keep = norm.map((r, i) => (r.regNo || r.name || r.email ? i : -1)).filter(i => i >= 0)
  const read = keep.map(i => all[i]), rows = keep.map(i => norm[i])
  const defaulted = new Set<Record<string, string>>()
  for (const r of rows) if (!r.email && r.regNo && REGNO.test(r.regNo)) { r.email = `${r.regNo.toLowerCase()}@${UNI_DOMAIN}`; defaulted.add(r) }
  if (!rows.length) throw new Invalid('The file has no data rows.')
  const allowUpdate = fd.get('update') === 'on'
  const [batches, mentors, existing] = await Promise.all([
    Batch.find().select('name').lean(),
    User.find({ type: { $in: ['mentor', 'faculty', 'trainer'] } }).select('email').lean(),
    Student.find({ $or: [{ regNo: { $in: rows.map(r => (r.regNo ?? '').toUpperCase()) } }, { email: { $in: rows.map(r => (r.email ?? '').toLowerCase()) } }] }).select('regNo email').lean(),
  ])
  const batchByName = new Map(batches.map(b => [b.name.toLowerCase(), b._id]))
  const mentorByEmail = new Map(mentors.map(m => [m.email, m._id]))
  const byReg = new Map(existing.map(s => [s.regNo, s]))
  const byEmail = new Map(existing.map(s => [s.email, s]))
  const seenReg = new Set<string>(), seenEmail = new Set<string>()

  const out: (ImportRow & { set?: Record<string, unknown> })[] = rows.map((d, i) => {
    const errors: string[] = []
    const regNo = (d.regNo ?? '').toUpperCase(), email = (d.email ?? '').toLowerCase()
    const current = byReg.get(regNo)
    if (!regNo) errors.push('Registration number is missing')
    else if (!REGNO.test(regNo)) errors.push('Registration number has invalid characters')
    if (!d.name && !(current && allowUpdate)) errors.push('Name is missing')
    if (!email) errors.push('University email is missing')
    else if (!EMAIL.test(email)) errors.push('University email is invalid')
    if (d.personalEmail && !EMAIL.test(d.personalEmail)) errors.push('Placement mail ID is invalid')
    if (d.phone && !/^[+\d][\d\s-]{6,18}$/.test(d.phone)) errors.push('Mobile number is invalid')
    const batch = d.batch ? batchByName.get(d.batch.toLowerCase()) : undefined
    if (d.batch && !batch) errors.push(`Batch "${d.batch}" does not exist`)
    const mentor = d.mentor ? mentorByEmail.get(d.mentor.toLowerCase()) : undefined
    if (d.mentor && !mentor) errors.push(`Mentor "${d.mentor}" is not a mentor/faculty account`)
    const status = (d.status || 'active').toLowerCase().replace(/\s+/g, '_')
    if (!(STATUSES as readonly string[]).includes(status)) errors.push(`Status must be one of ${STATUSES.join(', ')}`)

    const row = read[i].sheetRow
    if (errors.length) return { row, data: d, outcome: 'error', errors }
    if (seenReg.has(regNo)) return { row, data: d, outcome: 'duplicate', errors: ['Duplicate registration number in this file'] }
    if (seenEmail.has(email)) return { row, data: d, outcome: 'duplicate', errors: ['Duplicate email in this file'] }
    seenReg.add(regNo)
    seenEmail.add(email)
    const emailOwner = byEmail.get(email)
    if (emailOwner && emailOwner.regNo !== regNo) return { row, data: d, outcome: 'duplicate', errors: [`Email already belongs to ${emailOwner.regNo}`] }
    const set = {
      regNo, email, name: d.name, personalEmail: d.personalEmail?.toLowerCase() || undefined, phone: d.phone, department: d.department,
      specialization: d.specialization, year: d.year, section: d.section, status,
      ...(batch ? { batch } : {}), ...(mentor ? { mentor } : {}),
    }
    if (current) {
      if (!allowUpdate) return { row, data: d, outcome: 'skip', errors: ['Already exists (updates not enabled)'] }
      // updates change only the columns the file actually fills in — e.g. a file of ID + Placement Mail ID touches nothing else
      const has = (k: string) => !!d[k]
      const upd = Object.fromEntries(Object.entries({
        name: has('name') && d.name, email: !defaulted.has(d) && email, personalEmail: has('personalEmail') && d.personalEmail.toLowerCase(), phone: has('phone') && d.phone,
        department: has('department') && d.department, specialization: has('specialization') && d.specialization, year: has('year') && d.year, section: has('section') && d.section,
        status: has('status') && status, batch, mentor,
      }).filter(([, v]) => v)) as Record<string, unknown>
      return { row, data: d, outcome: 'update', errors: [], set: { regNo, ...upd } }
    }
    return { row, data: d, outcome: 'create', errors: [], set }
  })
  return out
}

const summarise = (rows: ImportRow[]) => ({
  total: rows.length,
  create: rows.filter(r => r.outcome === 'create').length,
  update: rows.filter(r => r.outcome === 'update').length,
  failed: rows.filter(r => r.outcome === 'error').length,
  duplicate: rows.filter(r => r.outcome === 'duplicate').length,
  skipped: rows.filter(r => r.outcome === 'skip').length,
})

export async function previewImport(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    await guard('students.create')
    const rows = await validateImport(fd)
    return { ok: `Checked ${rows.length} rows. Review below, then confirm.`, data: { rows: rows.map(({ set: _, ...r }) => r), summary: summarise(rows), done: false } }
  })
}

/** Re-validates server-side (never trusts the preview) and writes valid rows. */
export async function confirmImport(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('students.create')
    if (fd.get('update') === 'on' && !hasPerm(me.perms, 'students.edit')) throw new Invalid('Updating existing students needs the Edit Students permission.')
    const rows = await validateImport(fd)
    const ops = rows.filter(r => r.set).map(r => ({ updateOne: { filter: { regNo: String(r.set!.regNo) }, update: { $set: r.set! }, upsert: true } }))
    if (ops.length) await Student.bulkWrite(ops, { ordered: false })
    const summary = summarise(rows)
    await audit(me, 'students', 'student.import', `${summary.create} created, ${summary.update} updated`, undefined, summary)
    revalidatePath('/students')
    return { ok: `Import complete: ${summary.create} added, ${summary.update} updated.`, data: { rows: rows.map(({ set: _, ...r }) => r), summary, done: true } }
  })
}

/** One form, two buttons: the submitter's `op` picks the action. */
export async function bulkStudents(state: State, fd: FormData): Promise<State> {
  return fd.get('op') === 'accounts' ? createAccounts(state, fd) : bulkUpdate(state, fd)
}

/* ───────────── Dropped (Director) ───────────── */

/** Director marks a student dropped from a date: attendance shows D from then on, login switched off, left out of lists and counts. */
export async function dropStudent(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.approve')
    const id = oid(fd, 'id')
    const s = id ? await Student.findById(id).select('name regNo status').lean() : null
    if (!s) throw new Invalid('Student not found.')
    if (s.status === 'dropped') throw new Invalid(`${s.name} is already marked dropped.`)
    const day = str(fd, 'day', 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Invalid('Choose the date the student dropped from.')
    const reason = str(fd, 'reason', 300)
    if (reason.length < 3) throw new Invalid('Give the reason.')
    const u = await User.findOne({ student: id }).select('status').lean()
    await Student.updateOne({ _id: id }, { $set: { status: 'dropped', dropped: { day, reason, by: me._id, byName: me.name, at: new Date(), userStatus: u?.status ?? undefined } } })
    if (u) await User.updateOne({ _id: u._id }, { $set: { status: 'inactive' }, $inc: { sessionVersion: 1 } }) // no sign-in, no emails or notifications
    await audit(me, 'students', 'student.dropped', id, { status: s.status }, { status: 'dropped', day, reason })
    revalidatePath(`/students/${id}`)
    revalidatePath('/students')
    return { ok: `${s.name} marked dropped from ${day.split('-').reverse().join('.')}.` }
  })
}

export async function undoDropStudent(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.approve')
    const id = oid(fd, 'id')
    const s = id ? await Student.findById(id).select('name status dropped').lean() : null
    if (!s || s.status !== 'dropped') throw new Invalid('This student is not marked dropped.')
    await Student.updateOne({ _id: id }, { $set: { status: 'active' }, $unset: { dropped: '' } })
    if (s.dropped?.userStatus) await User.updateOne({ student: id }, { $set: { status: s.dropped.userStatus } })
    await audit(me, 'students', 'student.undropped', id, { status: 'dropped', day: s.dropped?.day }, { status: 'active' })
    revalidatePath(`/students/${id}`)
    revalidatePath('/students')
    return { ok: `${s.name} is active again.` }
  })
}

/** One click: create batch "A" (and the programme if there is none) and put every active student without a batch into it. */
export async function setupBatchA(_: State, _fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('students.edit')
    const program = (await Program.findOne().sort({ createdAt: 1 })) ?? (await Program.create({ name: 'Top Notch Marquee 2026', status: 'running' }))
    const a = (await Batch.findOne({ name: 'A' })) ?? (await Batch.create({ name: 'A', program: program._id }))
    const r = await Student.updateMany({ demo: { $ne: true }, status: { $ne: 'dropped' }, $or: [{ batch: null }, { batch: { $exists: false } }] }, { $set: { batch: a._id } })
    await audit(me, 'students', 'batch.setupA', a._id, undefined, { assigned: r.modifiedCount })
    revalidatePath('/students')
    revalidatePath('/attendance/register')
    return { ok: r.modifiedCount ? `Batch A is ready — ${r.modifiedCount} student${r.modifiedCount === 1 ? '' : 's'} added to it.` : 'Batch A is ready. Every student already has a batch.' }
  })
}

/* ───────────── Registration links to placement mail IDs ───────────── */

const RECENT_HOURS = 6 // a link issued in the last 6 hours counts as "already sent" — no duplicate emails on a re-run
const BUDGET_MS = 7_000 // each call stops well inside the server time limit; the button calls again until done

type Cand = { _id: Types.ObjectId; name: string; email: string; regNo: string; personalEmail?: string | null }
/** Who still needs a registration link at their placement mail ID: active students not registered (invited or no
 *  account), with a placement mail ID, and no link issued in the last RECENT_HOURS. */
async function inviteCandidates(scope: Record<string, unknown>) {
  const students = await Student.find({ ...scope, status: 'active' }).select('name email regNo personalEmail').sort({ regNo: 1 }).lean()
  const users = new Map((await User.find({ student: { $in: students.map(s => s._id) } }).select('name email status student invitedAt').lean()).map(u => [String(u.student), u]))
  const recentCut = Date.now() - RECENT_HOURS * 3_600_000
  const todo: Cand[] = [], noMail: string[] = []
  let recent = 0
  for (const s of students) {
    const u = users.get(String(s._id))
    if (u && u.status !== 'invited') continue // registered or deactivated
    if (!s.personalEmail || !EMAIL.test(s.personalEmail)) { noMail.push(s.regNo); continue }
    if (u?.invitedAt && +u.invitedAt > recentCut) { recent++; continue }
    todo.push(s)
  }
  return { todo, noMail, recent, users }
}

/** For the Students page button: how many are still to send, and how many were sent recently. */
export async function placementInviteCounts() {
  const me = await guard('users.create')
  const { todo, noMail, recent } = await inviteCandidates(await studentScope(me))
  return { todo: todo.length, recent, noMail: noMail.length }
}

/** Sends registration links (activation) to placement mail IDs — as many as fit in one short call; call again until remaining = 0.
 *  Invited students get a fresh link; students without an account get one created. The account keeps the university email. */
export async function sendPlacementInvites(_: State, _fd: FormData): Promise<State> {
  return attempt(async () => {
    const t0 = Date.now()
    const me = await guard('users.create')
    if (!mailEnabled()) throw new Invalid('Email is not set up on this server, so no links can be sent.')
    const role = await Role.findOne({ key: 'student' }).select('_id').lean()
    if (!role) throw new Invalid('The Student role is missing.')
    const { todo, noMail, users } = await inviteCandidates(await studentScope(me))
    let sent = 0, created = 0
    const failed: string[] = []
    for (const s of todo) {
      if (Date.now() - t0 > BUDGET_MS) break
      let u: { _id: Types.ObjectId; name: string; email: string } | undefined = users.get(String(s._id))
      if (!u) {
        if (await User.exists({ email: s.email })) { failed.push(s.regNo); continue }
        u = await User.create({ name: s.name, email: s.email, type: 'student', role: role._id, student: s._id, status: 'invited', createdBy: me._id })
        created++
      }
      const notSent = await issueLink(u, 'activate', s.personalEmail!)
      if (notSent) failed.push(s.regNo)
      else sent++
    }
    const remaining = Math.max(0, todo.length - sent - failed.length)
    await audit(me, 'users', 'account.placementInvites', `${sent} students`, undefined, { sent, created, failed, remaining })
    revalidatePath('/students')
    return { ok: `Sent ${sent}`, data: { sent, created, failed, remaining, noMail: noMail.length } }
  })
}
