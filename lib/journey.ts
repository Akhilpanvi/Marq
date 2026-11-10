import 'server-only'
import type { Types } from 'mongoose'
import { Application, Attendance, Batch, Evaluation, Interview, Program, TrainingSession, User } from '@/models'
import { attendanceCounts, resultPoints } from './intel'
import { profile, buckets } from './scoring'
import { getScoring } from './settings'

/** Everything about one student, used by the 360° profile (admin) and the student's own dashboard. */
export async function journey(studentId: Types.ObjectId, batchId?: Types.ObjectId | null) {
  const [cfg, results, attMap, attendance, evaluations, apps, interviews, batch] = await Promise.all([
    getScoring(),
    resultPoints({ student: studentId }),
    attendanceCounts({ student: studentId }),
    Attendance.find({ student: studentId }).sort({ date: -1 }).limit(400).populate('session', 'title date').lean(),
    Evaluation.find({ student: studentId }).sort({ date: -1 }).lean(),
    Application.find({ student: studentId }).sort({ updatedAt: -1 }).lean(),
    Interview.find({ student: studentId }).sort({ at: -1 }).lean(),
    batchId ? Batch.findById(batchId).lean() : null,
  ])
  const p = profile(results, attMap.get(String(studentId)), cfg)
  const [program, sessions, mentors] = await Promise.all([
    batch ? Program.findById(batch.program).lean() : null,
    batch ? TrainingSession.aggregate<{ _id: string; n: number }>([{ $match: { batch: batch._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]) : [],
    User.find({ _id: { $in: evaluations.map(e => e.mentor) } }).select('name').lean(),
  ])
  const sess = Object.fromEntries(sessions.map(s => [s._id, s.n]))
  const mentorName = new Map(mentors.map(m => [String(m._id), m.name]))

  // attendance by IST month
  const months = new Map<string, { month: string; present: number; absent: number; late: number; excused: number }>()
  for (const a of attendance) {
    const k = new Date(a.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
    const m = months.get(k) ?? { month: k, present: 0, absent: 0, late: 0, excused: 0 }
    m[a.status as 'present']++
    months.set(k, m)
  }

  const timeline = [
    ...results.map(r => ({ at: new Date(r.date), kind: 'Assessment', text: `${r.name} — ${r.marks == null ? 'absent' : `${r.marks}/${r.max} (${Math.round((r.marks / r.max) * 100)}%)`}` })),
    ...evaluations.map(e => ({ at: new Date(e.date ?? e.createdAt), kind: 'Mentor evaluation', text: `by ${mentorName.get(String(e.mentor)) ?? 'mentor'}${e.recommendations ? ` — ${e.recommendations}` : ''}` })),
    ...apps.flatMap(a => a.history.map(h => ({ at: new Date(h.at ?? a.createdAt), kind: 'Application', text: `${a.company} · ${a.role}: ${h.from ? `${h.from} → ` : ''}${h.to}` }))),
    ...interviews.map(i => ({ at: new Date(i.at), kind: 'Interview', text: `${i.company} · ${i.round} (${i.status}${i.result !== 'pending' ? `, ${i.result}` : ''})` })),
  ].sort((a, b) => +b.at - +a.at)

  return {
    p, results, attendance, evaluations, apps, interviews, batch, program, timeline,
    mentorName,
    trend: results.filter(r => r.marks != null).map(r => ({ date: new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), pct: Math.round((r.marks! / r.max) * 1000) / 10, name: r.name })),
    weekly: buckets(results, 'week'),
    monthly: buckets(results, 'month'),
    attendanceMonths: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    training: { completed: sess.completed ?? 0, total: (sess.completed ?? 0) + (sess.scheduled ?? 0) },
  }
}
