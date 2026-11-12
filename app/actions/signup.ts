'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { audit, clientIp, rateLimit, requireStudent } from '@/lib/auth'
import { attempt, EMAIL, Invalid, link, list, str, type State } from '@/lib/form'
import { db } from '@/lib/db'
import { issueLink } from '@/lib/tokens'
import { HANDLE, snapshotToday, syncStudent } from '@/lib/coding'
import { onboardingState, REQUIRED_HANDLES, REQUIRED_SKILLS } from '@/lib/onboarding'
import { PLATFORM_KEYS } from '@/lib/coding-points'
import { Role, Student, User } from '@/models'

const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => `${a}•••${b}`)

async function eligible(fd: FormData) {
  await db()
  const email = str(fd, 'email', 120).toLowerCase()
  if (!EMAIL.test(email)) throw new Invalid('Enter your university email or placement mail ID.')
  if (!(await rateLimit(`register:${(await clientIp()) ?? 'unknown'}`, 20, 600))) throw new Invalid('Too many attempts from this network. Try again in 10 minutes.')
  const s = await Student.findOne({ $or: [{ email }, { personalEmail: email }], status: 'active' }).select('name regNo email personalEmail department specialization').lean()
  if (!s) throw new Invalid('This email is not on the Top Notch Marquee list. Use your university email or placement mail ID, or contact the programme office.')
  const user = await User.findOne({ student: s._id }).select('status').lean()
  if (user?.status === 'active') throw new Invalid('You have already registered. Sign in, or use “Forgot your password?”.')
  if (user?.status === 'inactive') throw new Invalid('Your account is deactivated. Contact the programme office.')
  return { s, user }
}

/** Step 1: only emails on the Top Notch list are accepted; shows who the email belongs to. */
export async function checkRegistration(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const { s } = await eligible(fd)
    return { ok: 'Found you on the Top Notch list.', data: { name: s.name, regNo: s.regNo, department: s.department ?? '', specialization: s.specialization ?? '', email: mask(s.email), placement: s.personalEmail ? mask(s.personalEmail) : null } }
  })
}

/** Step 2: create (or reuse) the invited account and email the one-time activation link. The link is never shown on screen. */
export async function registerStudent(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const { s, user } = await eligible(fd)
    if (!(await rateLimit(`register-mail:${s._id}`, 1, 300))) throw new Invalid('A registration email was sent a moment ago. Check your inbox (and spam), or try again in 5 minutes.')
    const role = await Role.findOne({ key: 'student' }).select('_id').lean()
    if (!role) throw new Invalid('Registration is not available yet. Contact the programme office.')
    const u = user ? await User.findById(user._id).select('name email').lean() : await User.create({ name: s.name, email: s.email, type: 'student', role: role._id, student: s._id, status: 'invited' })
    // the link goes only to an address already on record — university email or placement mail ID — never one typed in
    const toPlacement = fd.get('sendTo') === 'placement'
    if (toPlacement && !s.personalEmail) throw new Invalid('No placement mail ID is on record for you. Use your university email.')
    const to = toPlacement ? s.personalEmail! : s.email
    const notEmailed = await issueLink(u!, 'activate', to)
    await audit({ _id: u!._id, name: s.name }, 'users', 'account.selfRegister', s.regNo, undefined, { emailed: !notEmailed, sentTo: toPlacement ? 'placement' : 'university' })
    if (notEmailed) {
      // test/dev only: production must prove ownership of the inbox
      if (process.env.REGISTRATION_SHOW_LINK === 'true') return { ok: 'Registered (test mode: link shown).', secret: notEmailed }
      throw new Invalid('We couldn’t send the email right now. Please try again later or contact the programme office.')
    }
    return { ok: `Check ${mask(to)} — we’ve emailed you a link to set your password. It expires in 7 days.` }
  })
}

/** Onboarding 1: coding usernames, each checked live. */
export async function onboardCoding(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    const handles: Record<string, string | undefined> = {}
    for (const p of [...PLATFORM_KEYS, 'github'] as const) {
      const v = str(fd, p, 40)
      if (v && !HANDLE.test(v)) throw new Invalid(`That ${p} username has characters usernames can’t contain.`)
      handles[p] = v || undefined
    }
    const missing = REQUIRED_HANDLES.filter(p => !handles[p])
    if (missing.length) throw new Invalid(`Add your ${missing.join(', ')} username${missing.length > 1 ? 's' : ''}.`)
    if (!(await rateLimit(`onboard-coding:${me.student}`, 8, 600))) throw new Invalid('Too many checks. Wait a few minutes and try again.')
    await Student.updateOne({ _id: me.student }, { $set: { handles } })
    await syncStudent(me.student)
    const st = await onboardingState(me.student)
    const notFound = [...st!.stats.values()].filter(x => x.status === 'not_found').map(x => `${x.platform} (“${x.handle}”)`)
    if (notFound.length) throw new Invalid(`These accounts don’t exist: ${notFound.join(', ')}. Check the usernames.`)
    await snapshotToday().catch(() => {})
    await audit(me, 'students', 'onboarding.coding', me.student)
    revalidatePath('/onboarding') // re-render so step 3 (profile) opens straight away
    return { ok: 'Coding profiles verified.' }
  })
}

/** Onboarding 2: profile details; completing it opens the portal. */
export async function onboardProfile(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await requireStudent()
    const phone = str(fd, 'phone', 20), personalEmail = str(fd, 'personalEmail', 120).toLowerCase()
    if (!/^[+\d][\d\s-]{6,18}$/.test(phone)) throw new Invalid('Enter a valid mobile number.')
    if (!EMAIL.test(personalEmail)) throw new Invalid('Enter a valid placement mail ID.')
    const professional = { headline: str(fd, 'headline', 140), linkedin: link(fd, 'linkedin'), github: link(fd, 'githubUrl'), portfolio: link(fd, 'portfolio'), resume: link(fd, 'resume'), skills: list(fd, 'skills') }
    if (!professional.headline) throw new Invalid('Add a one-line headline.')
    if (!professional.linkedin) throw new Invalid('Add your LinkedIn profile link.')
    if (!professional.resume) throw new Invalid('Add a link to your resume (Google Drive etc., viewable by link).')
    if (professional.skills.length < REQUIRED_SKILLS) throw new Invalid(`List at least ${REQUIRED_SKILLS} skills, separated by commas.`)
    await Student.updateOne({ _id: me.student }, { $set: { phone, personalEmail, professional } })
    const st = await onboardingState(me.student)
    if (!st?.codingDone) throw new Invalid('Finish the coding profiles step first.')
    await Student.updateOne({ _id: me.student }, { $set: { onboardedAt: new Date() } })
    await audit(me, 'students', 'onboarding.complete', me.student)
    redirect('/me')
  })
}
