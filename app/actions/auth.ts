'use server'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { audit, clientIp, currentUser, endSession, rateLimit, startSession } from '@/lib/auth'
import { hashPassword, passwordIssue, verifyPassword } from '@/lib/password'
import { str, type State } from '@/lib/form'
import { issueLink, sha256 } from '@/lib/tokens'
import { mailEnabled } from '@/lib/mail'
import { User } from '@/models'

const LOCK_AFTER = 5
const LOCK_MS = 15 * 60_000

export async function login(_: State, fd: FormData): Promise<State> {
  const id = str(fd, 'id', 120).toLowerCase()
  const password = String(fd.get('password') ?? '').slice(0, 128)
  if (!id || !password) return { error: 'Enter your email and password.' }
  await db()
  if (!(await rateLimit(`login:${(await clientIp()) ?? 'unknown'}`, 30, 600))) return { error: 'Too many sign-in attempts from this network. Try again in 10 minutes.' }

  const user = await User.findOne({ $or: [{ email: id }, { empId: id.toUpperCase() }] }).select('+passwordHash status sessionVersion failedLogins lockedUntil name')
  if (user?.lockedUntil && user.lockedUntil > new Date()) return { error: 'Too many failed attempts. Try again in 15 minutes.' }
  const valid = await verifyPassword(password, user?.passwordHash) // runs even for unknown users: constant-ish timing
  if (!user || !valid) {
    if (user)
      await User.updateOne({ _id: user._id }, user.failedLogins + 1 >= LOCK_AFTER ? { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } } : { $inc: { failedLogins: 1 } })
    return { error: 'Invalid credentials.' }
  }
  if (user.status !== 'active') return { error: user.status === 'invited' ? 'Activate your account using the link you were sent.' : 'This account is deactivated. Contact the programme office.' }

  after(() => User.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } }))
  await startSession(user)
  redirect('/')
}

export async function logout() {
  await endSession()
  redirect('/login')
}

export async function changePassword(_: State, fd: FormData): Promise<State> {
  const me = await currentUser()
  if (!me) redirect('/login')
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
