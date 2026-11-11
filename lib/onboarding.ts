import 'server-only'
import type { Types } from 'mongoose'
import { CodingStat, Student } from '@/models'

// Student onboarding after activation: both steps are mandatory before the portal opens.
export const REQUIRED_HANDLES = ['leetcode', 'codechef', 'github'] as const // Codeforces optional
export const REQUIRED_SKILLS = 3

export async function onboardingState(studentId: Types.ObjectId | string) {
  const [s, stats] = await Promise.all([
    Student.findById(studentId).select('name regNo email department specialization phone personalEmail handles professional onboardedAt').lean(),
    CodingStat.find({ student: studentId }).select('platform status handle').lean(),
  ])
  if (!s) return null
  const st = new Map(stats.map(x => [x.platform, x]))
  // a username counts once it has been checked and exists (a platform outage doesn't block the student)
  const codingDone = REQUIRED_HANDLES.every(p => s.handles?.[p] && st.get(p)?.handle === s.handles[p] && st.get(p)?.status !== 'not_found')
  const pr = s.professional
  const profileDone = !!(s.phone && s.personalEmail && pr?.headline && pr?.linkedin && pr?.resume && (pr?.skills?.length ?? 0) >= REQUIRED_SKILLS)
  return { s, stats: st, codingDone, profileDone, done: !!s.onboardedAt || (codingDone && profileDone) }
}
