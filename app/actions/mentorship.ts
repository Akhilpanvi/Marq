'use server'
import { revalidatePath } from 'next/cache'
import { assertStudentAccess, audit, guard } from '@/lib/auth'
import { attempt, date, Invalid, num, oid, oids, str, type State } from '@/lib/form'
import { notifyStudents } from '@/lib/notify'
import { Evaluation, Student } from '@/models'

const rating = (fd: FormData, k: string) => num(fd, k, { min: 1, max: 5, label: k })

export async function saveEvaluation(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'mentorship.edit' : 'mentorship.create')
    const student = oid(fd, 'student')
    if (!student) throw new Invalid('Choose a student.')
    await assertStudentAccess(me, student)
    const doc = {
      student, date: date(fd, 'date') ?? new Date(),
      ratings: { technical: rating(fd, 'technical'), coding: rating(fd, 'coding'), communication: rating(fd, 'communication'), aptitude: rating(fd, 'aptitude'), attitude: rating(fd, 'attitude') },
      strengths: str(fd, 'strengths', 2000), weaknesses: str(fd, 'weaknesses', 2000), recommendations: str(fd, 'recommendations', 2000), remarks: str(fd, 'remarks', 2000),
      followUp: { date: date(fd, 'followDate'), note: str(fd, 'followNote', 500), done: false },
    }
    if (!doc.strengths && !doc.weaknesses && !doc.recommendations && !doc.remarks) throw new Invalid('Add at least one of strengths, weaknesses, recommendations or remarks.')
    if (id) {
      const before = await Evaluation.findById(id).lean()
      if (!before) throw new Invalid('Evaluation not found.')
      // mentors may only edit their own evaluations; history stays (a new evaluation is the usual path)
      if (me.scope === 'assigned' && String(before.mentor) !== String(me._id)) throw new Invalid('You can only edit your own evaluations.')
      await Evaluation.updateOne({ _id: id }, { $set: doc })
      await audit(me, 'mentorship', 'evaluation.update', id, before, doc)
    } else {
      const e = await Evaluation.create({ ...doc, mentor: me._id })
      await audit(me, 'mentorship', 'evaluation.create', e._id, undefined, { student })
      await notifyStudents([student], { title: 'New mentor feedback', body: `${me.name} added an evaluation.`, link: '/me/performance' })
    }
    revalidatePath(`/students/${student}`)
    revalidatePath('/mentors')
    return { ok: 'Evaluation saved.' }
  })
}

export async function closeFollowUp(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('mentorship.edit')
    const id = oid(fd, 'id')
    const e = await Evaluation.findById(id).lean()
    if (!e) throw new Invalid('Evaluation not found.')
    await assertStudentAccess(me, e.student)
    await Evaluation.updateOne({ _id: id }, { $set: { 'followUp.done': true } })
    await audit(me, 'mentorship', 'followup.close', id)
    revalidatePath('/mentors')
    revalidatePath(`/students/${e.student}`)
    return { ok: 'Follow-up marked done.' }
  })
}

/** Mentor allocation (programme-wide roles only). */
export async function allocateMentor(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('students.edit')
    const mentor = oid(fd, 'mentor')
    const ids = oids(fd, 'ids')
    if (!mentor || !ids.length) throw new Invalid('Choose a mentor and at least one student.')
    const r = await Student.updateMany({ _id: { $in: ids } }, { $set: { mentor } })
    await audit(me, 'mentorship', 'mentor.allocate', mentor, undefined, { ids })
    revalidatePath('/mentors')
    return { ok: `Assigned ${r.modifiedCount} student(s).` }
  })
}
