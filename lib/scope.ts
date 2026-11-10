import 'server-only'
import { Batch, Student } from '@/models'
import type { Me } from './auth'

/** Batches this user may see: all, or the ones they train plus their mentees' batches. `null` = all. */
export async function visibleBatches(me: Me) {
  if (me.student) return (await Student.find({ _id: me.student }).distinct('batch')).filter(Boolean)
  if (me.scope === 'all') return null
  const [trained, mentees] = await Promise.all([Batch.find({ trainers: me._id }).distinct('_id'), Student.find({ mentor: me._id }).distinct('batch')])
  return [...trained, ...mentees.filter(Boolean)]
}
