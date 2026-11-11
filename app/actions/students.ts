'use server'
import { revalidatePath } from 'next/cache'
import { audit, guard } from '@/lib/auth'
import { attempt, EMAIL, Invalid, need, oid, oids, oneOf, REGNO, str, type State } from '@/lib/form'
import { normalise, readSheet } from '@/lib/sheet'
import { issueLink } from '@/lib/tokens'
import { hasPerm } from '@/lib/rbac'
import { Application, Attendance, AssessmentResult, Batch, Role, Student, User } from '@/models'

const STATUSES = ['active', 'on_hold', 'withdrawn', 'completed'] as const
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
    const photo = fd.get('photo')
    if (photo instanceof File && photo.size) {
      if (!PHOTO_TYPES.includes(photo.type)) throw new Invalid('Profile picture must be JPEG, PNG or WebP.')
      if (photo.size > 300 * 1024) throw new Invalid('Profile picture must be under 300 KB.')
      set.photo = { data: Buffer.from(await photo.arrayBuffer()), type: photo.type }
    }
    if (id) {
      const before = await Student.findById(id).select('-photo').lean()
      if (!before) throw new Invalid('Student not found.')
      await Student.updateOne({ _id: id }, { $set: set })
      await audit(me, 'students', 'student.update', id, before, { ...set, photo: undefined })
      revalidatePath(`/students/${id}`)
    } else {
      const s = await Student.create(set)
      await audit(me, 'students', 'student.create', s._id, undefined, { regNo, email })
    }
    revalidatePath('/students')
    return { ok: id ? 'Student updated.' : 'Student added.' }
  })
}

export async function deleteStudent(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('students.delete')
    const id = oid(fd, 'id')
    const s = await Student.findById(id).select('-photo').lean()
    if (!s) throw new Invalid('Student not found.')
    const history = (await Attendance.exists({ student: id })) || (await AssessmentResult.exists({ student: id })) || (await Application.exists({ student: id }))
    if (history) throw new Invalid('This student has training or placement history. Set their status to Withdrawn instead, so records stay intact.')
    await User.deleteMany({ student: id, status: 'invited' })
    await Student.deleteOne({ _id: id })
    await audit(me, 'students', 'student.delete', id, s)
    revalidatePath('/students')
    return { ok: 'Student deleted.' }
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
    const r = await Student.updateMany({ _id: { $in: ids } }, { $set: set })
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
  regNo: ['registration number', 'reg no', 'regno', 'reg. no', 'registration no', 'student id', 'id no'],
  name: ['full name', 'student name'],
  email: ['university email', 'college email', 'official email', 'email id'],
  personalEmail: ['placement mail id', 'placement email', 'placement email id', 'personal email'],
  phone: ['mobile', 'mobile number', 'phone number', 'contact'],
  department: ['dept', 'branch'],
  specialization: ['specialisation', 'stream'],
  year: ['academic year', 'yr'],
  section: ['sec'],
  batch: ['assigned batch', 'batch name'],
  mentor: ['mentor email', 'assigned mentor'],
  status: ['cohort status'],
}

export type ImportRow = { row: number; data: Record<string, string>; outcome: 'create' | 'update' | 'duplicate' | 'error' | 'skip'; errors: string[] }

async function validateImport(fd: FormData) {
  const rows = normalise(await readSheet(fd.get('file')), ALIASES)
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
    if (!regNo) errors.push('Registration number is missing')
    else if (!REGNO.test(regNo)) errors.push('Registration number has invalid characters')
    if (!d.name) errors.push('Name is missing')
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

    const row = i + 2
    if (errors.length) return { row, data: d, outcome: 'error', errors }
    if (seenReg.has(regNo)) return { row, data: d, outcome: 'duplicate', errors: ['Duplicate registration number in this file'] }
    if (seenEmail.has(email)) return { row, data: d, outcome: 'duplicate', errors: ['Duplicate email in this file'] }
    seenReg.add(regNo)
    seenEmail.add(email)
    const current = byReg.get(regNo)
    const emailOwner = byEmail.get(email)
    if (emailOwner && emailOwner.regNo !== regNo) return { row, data: d, outcome: 'duplicate', errors: [`Email already belongs to ${emailOwner.regNo}`] }
    const set = {
      regNo, email, name: d.name, personalEmail: d.personalEmail?.toLowerCase() || undefined, phone: d.phone, department: d.department,
      specialization: d.specialization, year: d.year, section: d.section, status,
      ...(batch ? { batch } : {}), ...(mentor ? { mentor } : {}),
    }
    if (current) return allowUpdate ? { row, data: d, outcome: 'update', errors: [], set } : { row, data: d, outcome: 'skip', errors: ['Already exists (updates not enabled)'] }
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
