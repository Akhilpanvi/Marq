'use server'
import { revalidatePath } from 'next/cache'
import { audit, guard, type Me } from '@/lib/auth'
import { attempt, date, Invalid, need, num, oid, oids, oneOf, str, type State } from '@/lib/form'
import { CATEGORIES } from '@/lib/scoring'
import { normalise, readSheet } from '@/lib/sheet'
import { notifyStudents } from '@/lib/notify'
import type { Types } from 'mongoose'
import { Assessment, AssessmentResult, Batch, Student } from '@/models'

async function access(me: Me, id: string | undefined) {
  const a = await Assessment.findById(id).lean()
  if (!a) throw new Invalid('Assessment not found.')
  if (me.scope === 'assigned' && String(a.trainer) !== String(me._id) && !(await Batch.exists({ _id: { $in: a.batches }, trainers: me._id })))
    throw new Invalid('You can only manage assessments for batches you train.')
  return a
}

/** Students who sit this assessment: its batches, or every active student when none are set. */
async function roster(a: { batches: Types.ObjectId[] }) {
  return Student.find(a.batches.length ? { batch: { $in: a.batches } } : { status: 'active' }).select('regNo name').lean()
}

export async function saveAssessment(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'assessments.edit' : 'assessments.create')
    const batches = oids(fd, 'batches')
    if (me.scope === 'assigned') {
      if (!batches.length) throw new Invalid('Choose the batch(es) you train.')
      if ((await Batch.countDocuments({ _id: { $in: batches }, trainers: me._id })) !== batches.length) throw new Invalid('You can only assess batches you train.')
    }
    const when = date(fd, 'date')
    if (!when) throw new Invalid('Choose the assessment date.')
    const doc = {
      name: need(fd, 'name', 'Assessment name', 160), category: oneOf(fd, 'category', CATEGORIES), maxMarks: num(fd, 'maxMarks', { min: 1, max: 10000, label: 'Maximum marks' }) ?? 100,
      date: when, durationMin: num(fd, 'durationMin', { min: 0, max: 1440, label: 'Duration' }), trainer: oid(fd, 'trainer') ?? me._id, batches, remarks: str(fd, 'remarks', 1000),
      status: oneOf(fd, 'status', ['scheduled', 'completed'] as const, 'scheduled'),
    }
    if (id) {
      const before = await access(me, id)
      if (doc.maxMarks < before.maxMarks && (await AssessmentResult.exists({ assessment: id, marks: { $gt: doc.maxMarks } }))) throw new Invalid('Some recorded marks exceed the new maximum.')
      await Assessment.updateOne({ _id: id }, { $set: doc })
      await audit(me, 'assessments', 'assessment.update', id, before, doc)
      revalidatePath(`/assessments/${id}`)
    } else {
      const a = await Assessment.create(doc)
      await audit(me, 'assessments', 'assessment.create', a._id, undefined, doc)
      if (+when > Date.now()) await notifyStudents((await roster(a)).map(s => s._id), { title: `Assessment scheduled: ${doc.name}`, body: `${doc.category} · ${when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}`, link: '/me/assessments' })
    }
    revalidatePath('/assessments')
    return { ok: 'Assessment saved.' }
  })
}

export async function deleteAssessment(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('assessments.delete')
    const a = await access(me, oid(fd, 'id'))
    if (await AssessmentResult.exists({ assessment: a._id })) throw new Invalid('Results have been recorded. Remove them first, or keep the assessment.')
    await Assessment.deleteOne({ _id: a._id })
    await audit(me, 'assessments', 'assessment.delete', a._id, a)
    revalidatePath('/assessments')
    return { ok: 'Assessment deleted.' }
  })
}

type Entry = { student: string; marks: number | null; remarks?: string }

async function writeResults(me: Me, a: { _id: Types.ObjectId; maxMarks: number; batches: Types.ObjectId[]; name: string }, entries: Entry[]) {
  const allowed = new Set((await roster(a)).map(s => String(s._id)))
  const existing = new Map((await AssessmentResult.find({ assessment: a._id }).lean()).map(r => [String(r.student), r]))
  const ops = []
  let changed = 0
  for (const e of entries) {
    if (!allowed.has(e.student)) continue
    if (e.marks != null && (e.marks < 0 || e.marks > a.maxMarks)) throw new Invalid(`Marks must be between 0 and ${a.maxMarks}.`)
    const prev = existing.get(e.student)
    if (prev && prev.marks === e.marks && (e.remarks == null || prev.remarks === e.remarks)) continue
    ops.push({
      updateOne: {
        filter: { assessment: a._id, student: e.student },
        update: { $set: { marks: e.marks, enteredBy: me._id, ...(e.remarks != null ? { remarks: e.remarks } : {}) }, ...(prev ? { $push: { history: { from: prev.marks, to: e.marks, by: me._id, at: new Date() } } } : {}) },
        upsert: true,
      },
    })
    changed++
  }
  if (ops.length) await AssessmentResult.bulkWrite(ops as never)
  if (changed) await Assessment.updateOne({ _id: a._id }, { $set: { status: 'completed' } })
  return changed
}

export async function saveMarks(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('assessments.edit')
    const a = await access(me, oid(fd, 'id'))
    const entries: Entry[] = []
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith('m_')) continue
      const raw = String(v).trim()
      if (raw === '') continue // blank = not entered
      const marks = raw.toLowerCase() === 'ab' ? null : Number(raw)
      if (marks !== null && !Number.isFinite(marks)) throw new Invalid(`"${raw}" is not a number. Use AB for absent.`)
      entries.push({ student: k.slice(2), marks, remarks: str(fd, `r_${k.slice(2)}`, 300) })
    }
    const changed = await writeResults(me, a, entries)
    await audit(me, 'assessments', 'results.update', a._id, undefined, { changed })
    if (changed) await notifyStudents(entries.map(e => e.student), { title: `Result published: ${a.name}`, link: '/me/assessments' })
    revalidatePath(`/assessments/${a._id}`)
    return { ok: changed ? `Saved ${changed} result${changed === 1 ? '' : 's'}.` : 'No changes to save.' }
  })
}

/** Excel/CSV with Registration Number, Marks (number or AB), optional Remarks. */
export async function importMarks(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('assessments.edit')
    const a = await access(me, oid(fd, 'id'))
    const rows = normalise(await readSheet(fd.get('file')), { regNo: ['registration number', 'reg no', 'regno', 'student id'], marks: ['score', 'obtained marks', 'marks obtained'], remarks: ['remark', 'comments'] })
    const students = new Map((await roster(a)).map(s => [s.regNo, String(s._id)]))
    const errors: string[] = []
    const entries: Entry[] = []
    rows.forEach((r, i) => {
      const sid = students.get((r.regNo ?? '').toUpperCase())
      const raw = (r.marks ?? '').trim()
      const marks = raw.toLowerCase() === 'ab' ? null : Number(raw)
      if (!sid) errors.push(`Row ${i + 2}: ${r.regNo || 'missing registration number'} is not in this assessment's batches`)
      else if (raw === '' || (marks !== null && (!Number.isFinite(marks) || marks < 0 || marks > a.maxMarks))) errors.push(`Row ${i + 2}: marks must be 0–${a.maxMarks} or AB`)
      else entries.push({ student: sid, marks, remarks: r.remarks })
    })
    if (errors.length) return { error: `${errors.length} row(s) need fixing — nothing was imported. ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '…' : ''}` }
    const changed = await writeResults(me, a, entries)
    await audit(me, 'assessments', 'results.import', a._id, undefined, { rows: rows.length, changed })
    revalidatePath(`/assessments/${a._id}`)
    return { ok: `Imported ${rows.length} rows (${changed} changed).` }
  })
}
