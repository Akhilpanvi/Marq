'use server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { audit, guard, rateLimit, requireStudent } from '@/lib/auth'
import { attempt, date, Invalid, link, list, need, num, oid, str, type State } from '@/lib/form'
import { HANDLE, snapshotToday, syncStudent } from '@/lib/coding'
import { PLATFORM_KEYS } from '@/lib/coding-points'
import { Batch, Student, Target } from '@/models'

const SYNC_GAP = 600 // seconds between a student's own syncs

async function syncNow(student: unknown) {
  await syncStudent(String(student))
  after(() => snapshotToday().catch(e => console.error('snapshot failed', e)))
}

export async function saveHandles(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    const handles = Object.fromEntries([...PLATFORM_KEYS, 'github' as const].map(p => {
      const v = str(fd, p, 40)
      if (v && !HANDLE.test(v)) throw new Invalid(`That ${p} username has characters usernames can't contain.`)
      return [p, v || undefined]
    }))
    await Student.updateOne({ _id: me.student }, { $set: { handles } })
    await audit(me, 'students', 'coding.handles', me.student, undefined, handles)
    if (await rateLimit(`coding:${me.student}`, 1, SYNC_GAP)) await syncNow(me.student)
    revalidatePath('/me/coding')
    return { ok: 'Coding profiles saved and synced.' }
  })
}

export async function syncMine(_: State, __: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    if (!(await rateLimit(`coding:${me.student}`, 1, SYNC_GAP))) throw new Invalid('You can sync once every 10 minutes. Profiles also refresh automatically every day.')
    await syncNow(me.student)
    revalidatePath('/me/coding')
    return { ok: 'Synced.' }
  })
}

export async function saveProfessional(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    const professional = { headline: str(fd, 'headline', 140), linkedin: link(fd, 'linkedin'), github: link(fd, 'github'), portfolio: link(fd, 'portfolio'), resume: link(fd, 'resume'), skills: list(fd, 'skills') }
    await Student.updateOne({ _id: me.student }, { $set: { professional, onLeaderboard: fd.get('onLeaderboard') === 'on' } })
    await audit(me, 'students', 'student.professional', me.student)
    revalidatePath('/me/profile')
    return { ok: 'Professional details saved.' }
  })
}

export async function saveTarget(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('training.create')
    const batch = await Batch.findById(oid(fd, 'batch')).select('_id trainers').lean()
    if (!batch) throw new Invalid('Choose a batch.')
    if (me.scope === 'assigned' && !batch.trainers.some(t => String(t) === String(me._id))) throw new Invalid('You can only set targets for batches you train.')
    const due = date(fd, 'due')
    if (!due) throw new Invalid('Choose a due date.')
    const t = await Target.create({ batch: batch._id, name: need(fd, 'name', 'Target name', 60), due, points: num(fd, 'points', { min: 1, max: 1e8, label: 'Points' }) ?? 0 })
    await audit(me, 'training', 'target.create', t._id, undefined, { batch: batch._id, due, points: t.points })
    revalidatePath('/training')
    return { ok: 'Target added.' }
  })
}

export async function deleteTarget(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('training.delete')
    const t = await Target.findByIdAndDelete(oid(fd, 'id')).lean()
    if (!t) throw new Invalid('Target not found.')
    await audit(me, 'training', 'target.delete', t._id, t)
    revalidatePath('/training')
    return { ok: 'Target removed.' }
  })
}
