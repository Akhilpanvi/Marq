import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Types } from 'mongoose'
import { db } from './db'
import { cookieName, MAX_AGE, sign, verify } from './session'
import { hasPerm, type Perm, type Scope } from './rbac'
import { AuditLog, Batch, RateLimit, Role, Student, User } from '@/models'
import { Invalid } from './form'

export type Me = {
  _id: Types.ObjectId
  name: string
  email: string
  type: string
  roleKey: string
  roleName: string
  perms: string[]
  scope: Scope
  student?: Types.ObjectId // set for student-portal users
}

export const currentUser = cache(async (): Promise<Me | null> => {
  const s = await verify((await cookies()).get(cookieName())?.value)
  if (!s) return null
  await db()
  const u = await User.findById(s.sub).select('name email type role status sessionVersion student').lean()
  if (!u || u.status !== 'active' || u.sessionVersion !== s.v) return null
  const role = await Role.findById(u.role).lean()
  if (!role) return null
  return {
    _id: u._id, name: u.name, email: u.email, type: u.type ?? 'administrative',
    roleKey: role.key, roleName: role.name, perms: role.perms ?? [], scope: (role.scope as Scope) ?? 'all',
    student: role.portal === 'student' ? (u.student ?? undefined) : undefined,
  }
})

export const can = (me: Me | null, p: Perm) => !!me && hasPerm(me.perms, p)

export async function requireUser() {
  const me = await currentUser()
  if (!me) redirect('/login')
  return me
}

/** Pages: redirect when the permission is missing. */
export async function requirePage(p: Perm) {
  const me = await requireUser()
  if (!can(me, p)) redirect('/denied')
  return me
}

/** Student portal pages. The student id always comes from the session, never the URL. */
export async function requireStudent() {
  const me = await requireUser()
  if (!me.student) redirect('/')
  return me as Me & { student: Types.ObjectId }
}

/** Server actions / route handlers: throw a user-facing error when the permission is missing. */
export async function guard(p: Perm) {
  const me = await currentUser()
  if (!me) throw new Invalid('Your session has expired. Sign in again.')
  if (!can(me, p)) throw new Invalid('You do not have permission to do that.')
  return me
}

/** Mongo filter on Student limiting what this user may see. `null` = everything. */
export const studentScope = cache(async (me: Me): Promise<Record<string, unknown>> => {
  if (me.student) return { _id: me.student }
  if (me.scope === 'all') return {}
  const batches = await Batch.find({ trainers: me._id }).distinct('_id')
  return { $or: [{ mentor: me._id }, { batch: { $in: batches } }] }
})

export async function scopedStudentIds(me: Me) {
  const f = await studentScope(me)
  return Object.keys(f).length ? Student.find(f).distinct('_id') : null
}

export async function assertStudentAccess(me: Me, studentId: string | Types.ObjectId) {
  const f = await studentScope(me)
  if (!Object.keys(f).length) return
  if (!(await Student.exists({ $and: [{ _id: studentId }, f] }))) throw new Invalid('You do not have access to this student.')
}

const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge })

export async function startSession(u: { _id: unknown; sessionVersion: number }) {
  ;(await cookies()).set(cookieName(), await sign({ sub: String(u._id), v: u.sessionVersion }), cookieOptions(MAX_AGE))
}

export async function endSession() {
  ;(await cookies()).set(cookieName(), '', cookieOptions(0))
}

export async function clientIp() {
  const h = await headers()
  return h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
}

export async function audit(me: Pick<Me, '_id' | 'name'> | null, module: string, action: string, target?: unknown, before?: unknown, after?: unknown) {
  await AuditLog.create({ actor: me?._id, actorName: me?.name ?? 'system', module, action, target: target == null ? undefined : String(target), before, after, ip: await clientIp() })
}

/** Fixed-window limiter stored in Mongo so it holds across serverless instances. */
export async function rateLimit(key: string, max: number, windowSec: number) {
  const now = Date.now()
  const doc = await RateLimit.findOneAndUpdate(
    { key, expiresAt: { $gt: new Date(now) } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' },
  ).lean()
  if (doc) return doc.count <= max
  await RateLimit.updateOne({ key }, { $set: { count: 1, expiresAt: new Date(now + windowSec * 1000) } }, { upsert: true }).catch(() => {}) // lost race = other request reset it
  return true
}

/** Assigned-scope staff (trainers) may only act on batches they train. */
export async function assertBatchAccess(me: Me, batchId: string | Types.ObjectId) {
  if (me.scope === 'all') return
  if (!(await Batch.exists({ _id: batchId, trainers: me._id }))) throw new Invalid('You can only manage batches you train.')
}
