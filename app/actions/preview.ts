'use server'
import { redirect } from 'next/navigation'
import { audit, currentUser, endPreview, startPreview } from '@/lib/auth'
import { Invalid } from '@/lib/form'
import { Application, AssessmentResult, Attendance, clearDemoCache, CodingStat, Evaluation, Feedback, Notification, Role, ScoreSnapshot, Student, User } from '@/models'

const DEMO = { regNo: 'DEMO-0001', name: 'Demo Student', email: 'demo.student@marq.invalid' }

async function superAdmin() {
  const me = await currentUser()
  if (!me || !(me.preview || me.perms.includes('*'))) throw new Invalid('Only the Super Administrator can use the student preview.')
  return me
}

/** The demo student + its login; created on first use, both flagged demo: true (hidden from every list and count). */
async function ensureDemo() {
  const role = await Role.findOne({ key: 'student' }).select('_id').lean()
  if (!role) throw new Invalid('The Student role is missing. Run the seed first.')
  let s = await Student.findOne({ demo: true }).select('_id').lean()
  if (!s) s = await Student.create({ ...DEMO, demo: true, status: 'active', department: 'CSE', specialization: 'Demo', year: '3' })
  if (!(await User.exists({ demo: true }))) await User.create({ name: DEMO.name, email: DEMO.email, type: 'student', role: role._id, student: s._id, status: 'active', demo: true })
  clearDemoCache()
  return s._id
}

export async function openPreview() {
  const me = await superAdmin()
  await ensureDemo()
  if (!me.preview) {
    await startPreview(me._id)
    await audit(me, 'users', 'preview.start')
  }
  redirect('/me')
}

export async function exitPreview() {
  await endPreview()
  redirect('/preview')
}

/** Wipes everything the demo student did, so the full flow (onboarding included) can be walked again. */
export async function resetDemo() {
  const me = await superAdmin()
  const id = await ensureDemo()
  const users = await User.find({ demo: true }).distinct('_id')
  await Promise.all([
    Application.deleteMany({ student: id }), CodingStat.deleteMany({ student: id }), ScoreSnapshot.deleteMany({ student: id }),
    Attendance.deleteMany({ student: id }), AssessmentResult.deleteMany({ student: id }), Evaluation.deleteMany({ student: id }),
    Notification.deleteMany({ user: { $in: users } }), Feedback.deleteMany({ user: { $in: users } }),
  ])
  await Student.updateOne({ _id: id }, { $unset: { handles: '', professional: '', phone: '', personalEmail: '', photoUrl: '', onboardedAt: '' } })
  await audit(me, 'users', 'preview.reset')
  redirect(me.preview ? '/me' : '/preview')
}
