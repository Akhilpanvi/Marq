'use server'
import { revalidatePath } from 'next/cache'
import { assertBatchAccess, audit, guard } from '@/lib/auth'
import { attempt, date, Invalid, link, need, oid, oids, oneOf, list, str, type State } from '@/lib/form'
import { notifyStudents } from '@/lib/notify'
import { Attendance, Batch, Program, Student, TrainingSession } from '@/models'

export async function saveProgram(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'training.edit' : 'training.create')
    const doc = { name: need(fd, 'name', 'Programme name', 120), description: str(fd, 'description', 1000), startDate: date(fd, 'startDate'), endDate: date(fd, 'endDate'), status: oneOf(fd, 'status', ['planned', 'running', 'completed'] as const, 'running') }
    if (id) await Program.updateOne({ _id: id }, { $set: doc })
    else await Program.create(doc)
    await audit(me, 'training', id ? 'program.update' : 'program.create', id ?? doc.name, undefined, doc)
    revalidatePath('/training')
    return { ok: 'Programme saved.' }
  })
}

export async function saveBatch(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'training.edit' : 'training.create')
    const program = oid(fd, 'program')
    if (!program) throw new Invalid('Choose a programme.')
    const doc = { name: need(fd, 'name', 'Batch name', 80), program, trainers: oids(fd, 'trainers'), startDate: date(fd, 'startDate'), endDate: date(fd, 'endDate') }
    const before = id ? await Batch.findById(id).lean() : null
    if (id) await Batch.updateOne({ _id: id }, { $set: doc })
    else await Batch.create(doc)
    await audit(me, 'training', id ? 'batch.update' : 'batch.create', id ?? doc.name, before, doc)
    revalidatePath('/training')
    return { ok: 'Batch saved.' }
  })
}

export async function saveSession(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'training.edit' : 'training.create')
    const batch = oid(fd, 'batch')
    if (!batch) throw new Invalid('Choose a batch.')
    await assertBatchAccess(me, batch)
    const when = date(fd, 'date')
    if (!when) throw new Invalid('Choose a date.')
    const time = (k: string) => { const v = str(fd, k, 5); if (v && !/^\d{2}:\d{2}$/.test(v)) throw new Invalid('Use HH:MM times.'); return v }
    const doc = {
      batch, title: need(fd, 'title', 'Session title', 160), topics: list(fd, 'topics'), trainer: oid(fd, 'trainer') ?? me._id,
      date: when, start: time('start'), end: time('end'), mode: oneOf(fd, 'mode', ['Offline', 'Online'] as const, 'Offline'), venue: str(fd, 'venue', 160),
      status: oneOf(fd, 'status', ['scheduled', 'completed', 'cancelled'] as const, 'scheduled'),
    }
    if (id) {
      const before = await TrainingSession.findById(id).select('-feedback').lean()
      if (!before) throw new Invalid('Session not found.')
      await assertBatchAccess(me, before.batch)
      await TrainingSession.updateOne({ _id: id }, { $set: doc })
      if (+before.date !== +when) await Attendance.updateMany({ session: id }, { $set: { date: when } })
      await audit(me, 'training', 'session.update', id, before, doc)
      revalidatePath(`/training/sessions/${id}`)
    } else {
      const s = await TrainingSession.create(doc)
      await audit(me, 'training', 'session.create', s._id, undefined, doc)
      const students = await Student.find({ batch, status: 'active' }).distinct('_id')
      await notifyStudents(students, { title: `New session: ${doc.title}`, body: `${when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}${doc.start ? ` at ${doc.start}` : ''}${doc.venue ? ` · ${doc.venue}` : ''}`, link: '/me/training' })
    }
    revalidatePath('/training')
    return { ok: 'Session saved.' }
  })
}

export async function addMaterial(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('training.edit')
    const s = await TrainingSession.findById(oid(fd, 'id')).select('batch').lean()
    if (!s) throw new Invalid('Session not found.')
    await assertBatchAccess(me, s.batch)
    const url = link(fd, 'url')
    if (!url) throw new Invalid('Add a link to the material (Drive, LMS, slides…).')
    await TrainingSession.updateOne({ _id: s._id }, { $push: { materials: { title: need(fd, 'title', 'Title', 160), url } } })
    revalidatePath(`/training/sessions/${s._id}`)
    return { ok: 'Material added.' }
  })
}

export async function removeMaterial(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('training.edit')
    const s = await TrainingSession.findById(oid(fd, 'id')).select('batch').lean()
    if (!s) throw new Invalid('Session not found.')
    await assertBatchAccess(me, s.batch)
    await TrainingSession.updateOne({ _id: s._id }, { $pull: { materials: { _id: oid(fd, 'material') } } })
    revalidatePath(`/training/sessions/${s._id}`)
    return { ok: 'Material removed.' }
  })
}

export async function deleteSession(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('training.delete')
    const s = await TrainingSession.findById(oid(fd, 'id')).select('-feedback').lean()
    if (!s) throw new Invalid('Session not found.')
    if (await Attendance.exists({ session: s._id })) throw new Invalid('Attendance has been recorded for this session. Mark it cancelled instead.')
    await TrainingSession.deleteOne({ _id: s._id })
    await audit(me, 'training', 'session.delete', s._id, s)
    revalidatePath('/training')
    return { ok: 'Session deleted.' }
  })
}

const STATUSES = ['present', 'absent', 'late', 'excused'] as const

/**
 * Marks attendance for a session. First marking needs attendance.create; changing an existing
 * mark is a correction: it needs attendance.edit and a reason, and keeps the previous value in history.
 */
export async function markAttendance(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('attendance.create')
    const session = await TrainingSession.findById(oid(fd, 'session')).select('batch date title').lean()
    if (!session) throw new Invalid('Session not found.')
    await assertBatchAccess(me, session.batch)
    const students = await Student.find({ batch: session.batch }).select('_id').lean()
    const allowed = new Set(students.map(s => String(s._id)))
    const existing = new Map((await Attendance.find({ session: session._id }).lean()).map(a => [String(a.student), a]))
    const reason = str(fd, 'reason', 300)
    const canCorrect = me.perms.includes('*') || me.perms.includes('attendance.edit')
    let marked = 0, corrected = 0
    const ops = []
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith('s_')) continue
      const sid = k.slice(2)
      const status = String(v)
      if (!allowed.has(sid) || !(STATUSES as readonly string[]).includes(status)) continue
      const prev = existing.get(sid)
      if (!prev) {
        ops.push({ insertOne: { document: { session: session._id, student: sid, status, date: session.date, markedBy: me._id } } })
        marked++
      } else if (prev.status !== status) {
        if (!canCorrect) throw new Invalid('Changing recorded attendance needs the Edit Attendance permission.')
        if (!reason) throw new Invalid('Enter a reason for the correction.')
        ops.push({ updateOne: { filter: { _id: prev._id }, update: { $set: { status, markedBy: me._id }, $push: { history: { from: prev.status, to: status, by: me._id, at: new Date(), reason } } } } })
        corrected++
      }
    }
    if (!ops.length) return { ok: 'No changes to save.' }
    await Attendance.bulkWrite(ops as never)
    if (marked) await TrainingSession.updateOne({ _id: session._id, status: 'scheduled' }, { $set: { status: 'completed' } })
    await audit(me, 'attendance', corrected ? 'attendance.correct' : 'attendance.mark', session._id, undefined, { marked, corrected, reason: reason || undefined })
    revalidatePath(`/training/sessions/${session._id}`)
    return { ok: `Saved: ${marked} marked${corrected ? `, ${corrected} corrected` : ''}.` }
  })
}
