'use server'
import { revalidatePath } from 'next/cache'
import { audit, clientIp, currentUser, guard, rateLimit } from '@/lib/auth'
import { attempt, EMAIL, Invalid, need, num, oid, oneOf, str, type State } from '@/lib/form'
import { db } from '@/lib/db'
import { notifyUsers } from '@/lib/notify'
import { Feedback, Role, Student, User } from '@/models'

const CATS = ['Suggestion', 'Bug', 'Question', 'Praise', 'Other'] as const

/** Anyone can send feedback. When signed in, identity comes from the account, not the form. */
export async function sendFeedback(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    await db()
    if (!(await rateLimit(`feedback:${(await clientIp()) ?? 'unknown'}`, 5, 600))) throw new Invalid('Thanks — you’ve sent several messages already. Try again in a few minutes.')
    const me = await currentUser()
    let name: string, email: string, role: string
    if (me) {
      name = me.name
      email = me.email
      const s = me.student ? await Student.findById(me.student).select('regNo').lean() : null
      role = s ? `${me.roleName} · ${s.regNo}` : me.roleName
    } else {
      name = need(fd, 'name', 'Name', 120)
      email = need(fd, 'email', 'Email', 120).toLowerCase()
      if (!EMAIL.test(email)) throw new Invalid('Enter a valid email so we can reply.')
      role = str(fd, 'role', 60) || 'Visitor'
    }
    const message = need(fd, 'message', 'Message', 3000)
    if (message.length < 5) throw new Invalid('Tell us a little more.')
    const f = await Feedback.create({ name, email, role, user: me?._id, category: oneOf(fd, 'category', CATS, 'Suggestion'), rating: num(fd, 'rating', { min: 1, max: 5, label: 'Rating' }), message, page: str(fd, 'page', 200) })
    const roles = await Role.find({ $or: [{ perms: '*' }, { perms: 'feedback.view' }] }).distinct('_id')
    await notifyUsers(await User.find({ role: { $in: roles }, status: 'active' }).distinct('_id'), { title: `New feedback: ${f.category}`, body: `${name} — ${message.slice(0, 140)}`, link: '/inbox' })
    revalidatePath('/inbox')
    return { ok: 'Thank you — your feedback has been sent to the MARQ team.' }
  })
}

export async function setFeedbackStatus(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('feedback.edit')
    const status = oneOf(fd, 'status', ['new', 'resolved'] as const)
    const f = await Feedback.findByIdAndUpdate(oid(fd, 'id'), { $set: { status, resolvedBy: status === 'resolved' ? me._id : null } }).lean()
    if (!f) throw new Invalid('Feedback not found.')
    await audit(me, 'feedback', `feedback.${status}`, f._id)
    revalidatePath('/inbox')
    return { ok: status === 'resolved' ? 'Marked resolved.' : 'Reopened.' }
  })
}
