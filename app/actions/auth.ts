'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Types } from 'mongoose'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { audit, clientIp, currentUser, endPreview, endSession, rateLimit, startSession } from '@/lib/auth'
import { hashPassword, passwordIssue, verifyPassword } from '@/lib/password'
import { str, type State } from '@/lib/form'
import { issueLink, sha256 } from '@/lib/tokens'
import { mailEnabled } from '@/lib/mail'
import { User } from '@/models'

const LOCK_AFTER = 5
const LOCK_MS = 15 * 60_000
const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT) || 30 // sign-in attempts per network per 10 min
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/

/** Sign-in ID: email, employee/student ID, or a staff username. */
const findLogin = (id: string) =>
  User.findOne({ $or: [{ email: id }, { empId: id.toUpperCase() }, ...(USERNAME.test(id) ? [{ username: id }] : [])] }).select('+passwordHash status sessionVersion failedLogins lockedUntil name role')

async function failed(user: { _id: Types.ObjectId; failedLogins: number }) {
  await User.updateOne({ _id: user._id }, user.failedLogins + 1 >= LOCK_AFTER ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } } : { $inc: { failedLogins: 1 } })
}

export async function login(_: State, fd: FormData): Promise<State> {
  const id = str(fd, 'id', 120).toLowerCase()
  const password = String(fd.get('password') ?? '').slice(0, 128)
  if (!id || !password) return { error: 'Enter your email and password.' }
  await db()
  if (!(await rateLimit(`login:${(await clientIp()) ?? 'unknown'}`, LOGIN_LIMIT, 600))) return { error: 'Too many sign-in attempts from this network. Try again in 10 minutes.' }

  const user = await findLogin(id)
  if (user?.lockedUntil && user.lockedUntil > new Date()) return { error: 'Too many failed attempts. Try again in 15 minutes.' }
  const valid = await verifyPassword(password, user?.passwordHash) // runs even for unknown users: constant-ish timing
  if (!user || !valid) {
    if (user) await failed(user)
    return { error: 'Invalid credentials.' }
  }
  if (user.status !== 'active') return { error: user.status === 'invited' ? 'Activate your account using the link you were sent.' : 'This account is deactivated. Contact the programme office.' }

  after(() => User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } }))
  await startSession(user)
  redirect('/')
}

export async function logout() {
  await endPreview()
  await endSession()
  redirect('/login')
}

export async function changePassword(_: State, fd: FormData): Promise<State> {
  const me = await currentUser()
  if (!me) redirect('/login')
  if (me.preview) return { error: 'Password changes are turned off in the student preview.' }
  const [current, next, confirm] = ['current', 'next', 'confirm'].map(k => String(fd.get(k) ?? ''))
  const issue = passwordIssue(next)
  if (issue) return { error: issue }
  if (next !== confirm) return { error: 'New passwords do not match.' }
  const user = await User.findById(me._id).select('+passwordHash sessionVersion')
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: 'Current password is incorrect.' }
  user.passwordHash = await hashPassword(next)
  user.sessionVersion += 1
  await user.save()
  await startSession(user)
  await audit(me, 'users', 'password.change', me._id)
  return { ok: 'Password updated. Other devices have been signed out.' }
}

/** Activation and reset links both land here: set a password, activate, sign in. */
export async function redeemToken(_: State, fd: FormData): Promise<State> {
  const token = str(fd, 'token', 100)
  const [next, confirm] = ['next', 'confirm'].map(k => String(fd.get(k) ?? ''))
  const issue = passwordIssue(next)
  if (issue) return { error: issue }
  if (next !== confirm) return { error: 'Passwords do not match.' }
  await db()
  const user = await User.findOneAndUpdate(
    { tokenHash: sha256(token), tokenExpires: { $gt: new Date() }, status: { $ne: 'inactive' } },
    { $set: { passwordHash: await hashPassword(next), status: 'active', failedLogins: 0 }, $unset: { tokenHash: 1, tokenExpires: 1, tokenPurpose: 1, lockedUntil: 1 }, $inc: { sessionVersion: 1 } },
    { returnDocument: 'after' },
  ).select('name sessionVersion activatedAt')
  if (!token || !user) return { error: 'This link is invalid, already used, or expired. Ask the programme office for a new one.' }
  if (!user.activatedAt) await User.updateOne({ _id: user._id }, { $set: { activatedAt: new Date() } })
  await audit({ _id: user._id, name: user.name }, 'users', user.activatedAt ? 'password.reset' : 'account.activate', user._id)
  await startSession(user)
  redirect('/')
}

/** Always answers the same way so it can't be used to discover accounts. */
export async function requestReset(_: State, fd: FormData): Promise<State> {
  if (!mailEnabled()) return { error: 'Email reset is not available. Contact the programme office to reset your password.' }
  const id = str(fd, 'id', 120).toLowerCase()
  if (!id) return { error: 'Enter your email.' }
  await db()
  if (!(await rateLimit(`reset:${(await clientIp()) ?? 'unknown'}`, 5, 900))) return { error: 'Too many requests. Try again later.' }
  const user = await User.findOne({ email: id, status: 'active' }).select('name email').lean()
  if (user) after(() => issueLink(user, 'reset'))
  return { ok: 'If an account matches, a reset link has been emailed. It expires in 30 minutes.' }
}

/** From the sign-in page: change a password with the current one, then sign in. Same lockout and limits as login. */
export async function changePasswordAtLogin(_: State, fd: FormData): Promise<State> {
  const id = str(fd, 'id', 120).toLowerCase()
  const [current, next, confirm] = ['current', 'next', 'confirm'].map(k => String(fd.get(k) ?? '').slice(0, 128))
  if (!id || !current) return { error: 'Enter your sign-in ID and current password.' }
  const issue = passwordIssue(next)
  if (issue) return { error: issue }
  if (next !== confirm) return { error: 'New passwords do not match.' }
  if (next === current) return { error: 'Choose a password different from your current one.' }
  await db()
  if (!(await rateLimit(`login:${(await clientIp()) ?? 'unknown'}`, LOGIN_LIMIT, 600))) return { error: 'Too many attempts from this network. Try again in 10 minutes.' }
  const user = await findLogin(id)
  if (user?.lockedUntil && user.lockedUntil > new Date()) return { error: 'Too many failed attempts. Try again in 15 minutes.' }
  const valid = await verifyPassword(current, user?.passwordHash)
  if (!user || !valid) {
    if (user) await failed(user)
    return { error: 'Sign-in ID or current password is incorrect.' }
  }
  if (user.status !== 'active') return { error: 'This account is not active.' }
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(next), failedLogins: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 }, $inc: { sessionVersion: 1 } })
  await audit({ _id: user._id, name: user.name }, 'users', 'password.change', user._id)
  await startSession({ _id: user._id, sessionVersion: user.sessionVersion + 1 })
  redirect('/')
}

/** Staff choose a short sign-in username (needs the current password). Students sign in with their university email. */
export async function setUsername(_: State, fd: FormData): Promise<State> {
  const me = await currentUser()
  if (!me) redirect('/login')
  if (me.student) return { error: 'Students sign in with their university email.' }
  const username = str(fd, 'username', 30).toLowerCase()
  if (username && !USERNAME.test(username)) return { error: 'Use 3–30 letters, digits, dots, dashes or underscores, starting with a letter or digit.' }
  const user = await User.findById(me._id).select('+passwordHash username')
  if (!user || !(await verifyPassword(String(fd.get('current') ?? ''), user.passwordHash))) return { error: 'Current password is incorrect.' }
  const before = user.username
  try {
    await User.updateOne({ _id: me._id }, username ? { $set: { username } } : { $unset: { username: 1 } })
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { error: 'That username is taken.' }
    throw e
  }
  await audit(me, 'users', 'user.username', me._id, { username: before }, { username: username || null })
  revalidatePath('/account')
  return { ok: username ? `You can now sign in as “${username}”.` : 'Username removed. Sign in with your email.' }
}
