import 'server-only'
import { Types } from 'mongoose'
import { Attendance, AssessmentResult, CodingStat } from '@/models'
import { getScoring } from './settings'
import { profile, type AttendanceCounts, type Dev, type ResultPoint } from './scoring'

// ponytail: scores are computed on read (128 students ≈ a few thousand rows). Denormalise onto Student if the cohort reaches ~10k.

export async function resultPoints(match: Record<string, unknown>) {
  return AssessmentResult.aggregate<ResultPoint & { student: Types.ObjectId; name: string; assessment: Types.ObjectId }>([
    { $match: match },
    { $lookup: { from: 'assessments', localField: 'assessment', foreignField: '_id', as: 'a' } },
    { $unwind: '$a' },
    { $project: { student: 1, assessment: 1, marks: 1, category: '$a.category', date: '$a.date', max: '$a.maxMarks', name: '$a.name' } },
    { $sort: { date: 1 } },
  ])
}

export async function attendanceCounts(match: Record<string, unknown>) {
  const rows = await Attendance.aggregate<{ _id: { s: Types.ObjectId; st: keyof AttendanceCounts }; n: number }>([
    { $match: match },
    { $group: { _id: { s: '$student', st: '$status' }, n: { $sum: 1 } } },
  ])
  const m = new Map<string, Partial<AttendanceCounts>>()
  for (const r of rows) {
    const k = String(r._id.s)
    m.set(k, { ...m.get(k), [r._id.st]: r.n })
  }
  return m
}

/** Coding points (LeetCode + CodeChef + Codeforces) and GitHub stats per student; null when not linked. */
export async function devStats(match: Record<string, unknown>) {
  const stats = await CodingStat.find(match).select('student platform status points github').lean()
  const m = new Map<string, Dev>()
  for (const s of stats) {
    const d = m.get(String(s.student)) ?? m.set(String(s.student), {}).get(String(s.student))!
    if (s.platform === 'github') { if (s.status !== 'not_found' && s.github) d.github = s.github }
    else if (s.status !== 'not_found') d.codingPoints = (d.codingPoints ?? 0) + (s.points ?? 0)
  }
  return m
}

/** Profiles for the given students (or everyone when `ids` is null). */
export async function profiles(ids: Types.ObjectId[] | null) {
  const match = ids ? { student: { $in: ids } } : {}
  const [cfg, results, att, dev] = await Promise.all([getScoring(), resultPoints(match), attendanceCounts(match), devStats(match)])
  const byStudent = new Map<string, ResultPoint[]>()
  for (const r of results) (byStudent.get(String(r.student)) ?? byStudent.set(String(r.student), []).get(String(r.student))!).push(r)
  const keys = ids ? ids.map(String) : [...new Set([...byStudent.keys(), ...att.keys(), ...dev.keys()])]
  return new Map(keys.map(k => [k, profile(byStudent.get(k) ?? [], att.get(k), cfg, dev.get(k))]))
}
