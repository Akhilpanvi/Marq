import 'server-only'
import { Types } from 'mongoose'
import { can, scopedStudentIds, type Me } from './auth'
import { profiles } from './intel'
import { attendancePct, DIMENSIONS, type Dim } from './scoring'
import { placementStatus, OFFERED, REJECTED, DRIVE_OPTIONS } from './placement'
import { Application, Assessment, Job, AssessmentResult, Attendance, Batch, CodingStat, Evaluation, Interview, Student, Target, User } from '@/models'
import { PLATFORMS, PLATFORM_KEYS, platformPoints, targetFlag } from './coding-points'
import type { Perm } from './rbac'

export type Report = { title: string; columns: string[]; rows: (string | number | null)[][] }
type Def = { title: string; description: string; perm: Perm; build: (me: Me, p: URLSearchParams) => Promise<Report> }

const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10)
const d = (x?: Date | null) => (x ? new Date(x).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '')

async function scopedStudents(me: Me, p: URLSearchParams) {
  const ids = await scopedStudentIds(me)
  const f: Record<string, unknown> = ids ? { _id: { $in: ids } } : {}
  const batch = p.get('batch')
  if (batch && Types.ObjectId.isValid(batch)) f.batch = batch
  const students = await Student.find(f).select('regNo name email department section year batch mentor status').sort({ regNo: 1 }).lean()
  const [batches, mentors] = await Promise.all([Batch.find().select('name').lean(), User.find({ _id: { $in: students.flatMap(s => (s.mentor ? [s.mentor] : [])) } }).select('name').lean()])
  return { students, ids: students.map(s => s._id), bName: new Map(batches.map(b => [String(b._id), b.name])), mName: new Map(mentors.map(m => [String(m._id), m.name])) }
}

export const REPORTS: Record<string, Def> = {
  students: {
    title: 'Student roster', description: 'Personal, academic and cohort details.', perm: 'students.view',
    build: async (me, p) => {
      const { students, bName, mName } = await scopedStudents(me, p)
      return { title: 'Student roster', columns: ['Registration No', 'Name', 'University Email', 'Department', 'Year', 'Section', 'Batch', 'Mentor', 'Status'], rows: students.map(s => [s.regNo, s.name, s.email, s.department ?? '', s.year ?? '', s.section ?? '', bName.get(String(s.batch)) ?? '', mName.get(String(s.mentor)) ?? '', s.status ?? '']) }
    },
  },
  performance: {
    title: 'Student performance', description: 'Overall, readiness and every dimension score, with trend and flags.', perm: 'performance.view',
    build: async (me, p) => {
      const { students, ids, bName } = await scopedStudents(me, p)
      const prof = await profiles(ids)
      const dims = Object.keys(DIMENSIONS) as Dim[]
      return {
        title: 'Student performance', columns: ['Registration No', 'Name', 'Batch', 'Overall', 'Readiness', ...dims.map(k => DIMENSIONS[k]), 'Assessment avg', 'Assessments', 'Trend (pts/assessment)', 'Flags'],
        rows: students.map(s => {
          const x = prof.get(String(s._id))!
          return [s.regNo, s.name, bName.get(String(s.batch)) ?? '', r1(x.overall), r1(x.readiness), ...dims.map(k => r1(x.dims[k])), r1(x.assessmentAvg), x.assessments, r1(x.trend), Object.entries(x.flags).filter(([, v]) => v).map(([k]) => k).join(', ')]
        }),
      }
    },
  },
  attendance: {
    title: 'Training attendance', description: 'Student-wise present / late / absent / excused and percentage.', perm: 'attendance.view',
    build: async (me, p) => {
      const { students, ids, bName } = await scopedStudents(me, p)
      const match: Record<string, unknown> = { student: { $in: ids } }
      const from = p.get('from'), to = p.get('to')
      if (from || to) match.date = { ...(from ? { $gte: new Date(`${from}T00:00:00+05:30`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59+05:30`) } : {}) }
      const agg = await Attendance.aggregate<{ _id: { s: Types.ObjectId; st: string }; n: number }>([{ $match: match }, { $group: { _id: { s: '$student', st: '$status' }, n: { $sum: 1 } } }])
      const m = new Map<string, Record<string, number>>()
      agg.forEach(a => m.set(String(a._id.s), { ...m.get(String(a._id.s)), [a._id.st]: a.n }))
      return { title: 'Training attendance', columns: ['Registration No', 'Name', 'Batch', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %'], rows: students.map(s => { const c = m.get(String(s._id)) ?? {}; return [s.regNo, s.name, bName.get(String(s.batch)) ?? '', c.present ?? 0, c.late ?? 0, c.absent ?? 0, c.excused ?? 0, r1(attendancePct(c))] }) }
    },
  },
  assessments: {
    title: 'Assessment results', description: 'Every result with category, marks and percentage.', perm: 'assessments.view',
    build: async (me, p) => {
      const { students, ids } = await scopedStudents(me, p)
      const sInfo = new Map(students.map(s => [String(s._id), s]))
      const filter: Record<string, unknown> = { student: { $in: ids } }
      const cat = p.get('category')
      const results = await AssessmentResult.find(filter).lean()
      const as = new Map((await Assessment.find({ _id: { $in: results.map(r => r.assessment) }, ...(cat ? { category: cat } : {}) }).lean()).map(a => [String(a._id), a]))
      return {
        title: 'Assessment results', columns: ['Assessment', 'Category', 'Date', 'Registration No', 'Name', 'Marks', 'Max', 'Percent', 'Remarks'],
        rows: results.filter(r => as.has(String(r.assessment))).map(r => { const a = as.get(String(r.assessment))!, s = sInfo.get(String(r.student)); return [a.name, a.category, d(a.date), s?.regNo ?? '', s?.name ?? '', r.marks ?? 'AB', a.maxMarks, r.marks == null ? null : r1((r.marks / a.maxMarks) * 100), r.remarks ?? ''] })
          .sort((x, y) => String(x[2]).localeCompare(String(y[2]))),
      }
    },
  },
  coding: {
    title: 'Coding platforms', description: 'Coding points per platform, ratings, attendance and target status, ranked.', perm: 'students.view',
    build: async (me, p) => {
      const { students, ids, bName } = await scopedStudents(me, p)
      const [stats, att, targets] = await Promise.all([
        CodingStat.find({ student: { $in: ids } }).lean(),
        Attendance.aggregate<{ _id: Types.ObjectId; att: number; n: number }>([{ $match: { student: { $in: ids }, status: { $ne: 'excused' } } }, { $group: { _id: '$student', att: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }, n: { $sum: 1 } } }]),
        Target.find({ due: { $lte: new Date() } }).sort({ due: -1 }).lean(),
      ])
      const by = new Map<string, typeof stats>()
      stats.forEach(c => by.set(String(c.student), [...(by.get(String(c.student)) ?? []), c]))
      const a = new Map(att.map(x => [String(x._id), x.n ? (x.att / x.n) * 100 : null]))
      const rows = students.map(s => {
        const cs = by.get(String(s._id)) ?? []
        const total = cs.reduce((t, c) => t + (c.points ?? 0), 0)
        const target = targets.find(t => String(t.batch) === String(s.batch))
        return { s, cs, total, target, flag: targetFlag(total, target?.points) }
      }).sort((x, y) => y.total - x.total)
      const cols = PLATFORM_KEYS.flatMap(k => [`${PLATFORMS[k].label} rating`, `${PLATFORMS[k].label} points`])
      return {
        title: 'Coding platforms', columns: ['Rank', 'Registration No', 'Name', 'Batch', 'Attendance %', ...cols, 'Total points', 'Target', 'Target status'],
        rows: rows.map((r, i) => [i + 1, r.s.regNo, r.s.name, bName.get(String(r.s.batch)) ?? '', r1(a.get(String(r.s._id))), ...PLATFORM_KEYS.flatMap(k => { const c = r.cs.find(x => x.platform === k); return [c?.rating ?? null, c ? platformPoints(k, c) : null] }), r.total, r.target ? `${r.target.name} (${r.target.points})` : '', r.flag === 'met' ? 'Met' : r.flag === 'behind' ? 'Work harder' : r.flag === 'far' ? 'Improve immediately' : '']),
      }
    },
  },
  drives: {
    title: 'Drive status', description: 'Per company drive: how many students answered, and how many are at each stage (the Google-Form question).', perm: 'applications.view',
    build: async (me, p) => {
      const { ids } = await scopedStudents(me, p)
      const jobs = await Job.find({ status: { $in: ['open', 'closed'] } }).populate<{ company: { name: string } }>('company', 'name').sort({ createdAt: 1 }).lean()
      const apps = await Application.find({ job: { $in: jobs.map(j => j._id) }, student: { $in: ids } }).select('job status').lean()
      return {
        title: 'Drive status',
        columns: ['Company', 'Role', 'Registration', 'Answered', 'Not answered', ...DRIVE_OPTIONS.map(([l]) => l)],
        rows: jobs.map(j => {
          const a = apps.filter(x => String(x.job) === String(j._id))
          return [j.company?.name ?? '', j.role, j.status === 'open' ? 'Open' : 'Closed', a.length, ids.length - a.length, ...DRIVE_OPTIONS.map(([, s]) => a.filter(x => x.status === s).length)]
        }),
      }
    },
  },
  evaluations: {
    title: 'Mentor evaluations', description: 'Ratings, strengths, weaknesses and recommendations.', perm: 'mentorship.view',
    build: async (me, p) => {
      const { students, ids } = await scopedStudents(me, p)
      const sInfo = new Map(students.map(s => [String(s._id), s]))
      const evals = await Evaluation.find({ student: { $in: ids } }).sort({ date: -1 }).lean()
      const mentors = new Map((await User.find({ _id: { $in: evals.map(e => e.mentor) } }).select('name').lean()).map(u => [String(u._id), u.name]))
      return {
        title: 'Mentor evaluations', columns: ['Date', 'Registration No', 'Student', 'Mentor', 'Technical', 'Coding', 'Communication', 'Aptitude', 'Attitude', 'Strengths', 'Weaknesses', 'Recommendations', 'Follow-up'],
        rows: evals.map(e => [d(e.date), sInfo.get(String(e.student))?.regNo ?? '', sInfo.get(String(e.student))?.name ?? '', mentors.get(String(e.mentor)) ?? '', e.ratings?.technical ?? null, e.ratings?.coding ?? null, e.ratings?.communication ?? null, e.ratings?.aptitude ?? null, e.ratings?.attitude ?? null, e.strengths ?? '', e.weaknesses ?? '', e.recommendations ?? '', e.followUp?.date ? `${d(e.followUp.date)}${e.followUp.done ? ' (done)' : ''}` : '']),
      }
    },
  },
  applications: {
    title: 'Job applications', description: 'Every application with source and current status.', perm: 'applications.view',
    build: async (me, p) => {
      const { students, ids } = await scopedStudents(me, p)
      const sInfo = new Map(students.map(s => [String(s._id), s]))
      const apps = await Application.find({ student: { $in: ids } }).sort({ updatedAt: -1 }).lean()
      return { title: 'Job applications', columns: ['Registration No', 'Name', 'Company', 'Role', 'Source', 'Applied on', 'Status', 'Status changes', 'Last updated', 'Remarks'], rows: apps.map(a => [sInfo.get(String(a.student))?.regNo ?? '', sInfo.get(String(a.student))?.name ?? '', a.company, a.role, a.source ?? '', d(a.appliedOn), a.status, a.history.length, d(a.updatedAt), a.remarks ?? '']) }
    },
  },
  interviews: {
    title: 'Interview outcomes', description: 'All interview rounds with result and feedback.', perm: 'interviews.view',
    build: async (me, p) => {
      const { students, ids } = await scopedStudents(me, p)
      const sInfo = new Map(students.map(s => [String(s._id), s]))
      const list = await Interview.find({ student: { $in: ids } }).sort({ at: -1 }).lean()
      return { title: 'Interview outcomes', columns: ['Date', 'Registration No', 'Name', 'Company', 'Role', 'Round', 'Mode', 'Status', 'Result', 'Feedback'], rows: list.map(i => [d(i.at), sInfo.get(String(i.student))?.regNo ?? '', sInfo.get(String(i.student))?.name ?? '', i.company ?? '', i.role ?? '', i.round, i.mode ?? '', i.status ?? '', i.result ?? '', i.feedback ?? '']) }
    },
  },
  companies: {
    title: 'Company-wise recruitment', description: 'Applications, offers, acceptances and rejections per company.', perm: 'applications.view',
    build: async (me, p) => {
      const { ids } = await scopedStudents(me, p)
      const agg = await Application.aggregate<{ _id: string; apps: number; students: unknown[]; offers: number; accepted: number; rejected: number }>([
        { $match: { student: { $in: ids } } },
        { $group: { _id: '$company', apps: { $sum: 1 }, students: { $addToSet: '$student' }, offers: { $sum: { $cond: [{ $in: ['$status', OFFERED] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $in: ['$status', REJECTED] }, 1, 0] } } } },
        { $sort: { apps: -1 } },
      ])
      return { title: 'Company-wise recruitment', columns: ['Company', 'Applications', 'Students', 'Offers', 'Accepted', 'Rejected'], rows: agg.map(c => [c._id, c.apps, c.students.length, c.offers, c.accepted, c.rejected]) }
    },
  },
  placement: {
    title: 'Placement statistics', description: 'Each student’s placement status, offers and applications.', perm: 'applications.view',
    build: async (me, p) => {
      const { students, ids, bName } = await scopedStudents(me, p)
      const apps = await Application.find({ student: { $in: ids } }).select('student status company').lean()
      const by = new Map<string, typeof apps>()
      apps.forEach(a => by.set(String(a.student), [...(by.get(String(a.student)) ?? []), a]))
      return {
        title: 'Placement statistics', columns: ['Registration No', 'Name', 'Batch', 'Placement status', 'Applications', 'Offers', 'Accepted at'],
        rows: students.map(s => { const a = by.get(String(s._id)) ?? []; return [s.regNo, s.name, bName.get(String(s.batch)) ?? '', placementStatus(a).label, a.length, a.filter(x => OFFERED.includes(x.status)).length, a.filter(x => x.status === 'Accepted').map(x => x.company).join(', ')] }),
      }
    },
  },

}

/** Reports need reports.view, the module's own view permission, and (for downloads) an export permission. */
export function canReport(me: Me | null, key: string, exporting: boolean) {
  const def = REPORTS[key]
  if (!me || !def || me.student) return false
  if (!can(me, def.perm) || !can(me, 'reports.view')) return false
  if (exporting && !(can(me, 'reports.export') || (key === 'students' && can(me, 'students.export')))) return false
  return true
}
