// Idempotent bootstrap: system roles + first Super Administrator. Never creates students or sample data.
// npm run seed
import { createHash, randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import { db } from '../lib/db'
import { hashPassword, passwordIssue } from '../lib/password'
import { DEFAULT_ROLES } from '../lib/rbac'
import { Role, User } from '../models'

export async function seedRoles() {
  for (const r of DEFAULT_ROLES)
    await Role.updateOne(
      { key: r.key },
      { $setOnInsert: { key: r.key, perms: r.perms }, $set: { name: r.name, description: r.description, scope: r.scope, portal: r.portal ?? null, system: true } },
      { upsert: true },
    )
  // superadmin always keeps full control, even if someone edited it
  await Role.updateOne({ key: 'superadmin' }, { $set: { perms: ['*'] } })
  // permissions added to built-in roles after first release (idempotent)
  for (const [key, perms] of Object.entries(ADDED_PERMS)) await Role.updateOne({ key }, { $addToSet: { perms: { $each: perms } } })
  // Finance module removed (Nov 2026): drop its permissions and the Director Accounts role if nobody holds it
  const fin = await Role.find({ perms: { $regex: '^finance\\.' } }).select('_id perms').lean()
  for (const r of fin) await Role.updateOne({ _id: r._id }, { $set: { perms: r.perms.filter(p => !p.startsWith('finance.')) } })
  const da = await Role.findOne({ key: 'director_accounts' }).lean()
  if (da && !(await User.exists({ role: da._id }))) await Role.deleteOne({ _id: da._id })
}

/** Daily register (Nov 2026): assistants post attendance, the Director approves changes. */
const ADDED_PERMS: Record<string, string[]> = {
  admin_assistant: ['attendance.view', 'attendance.create'],
  director: ['attendance.approve'],
  admin: ['feedback.view', 'feedback.edit'],
}

async function main() {
  await db()
  await seedRoles()
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD ?? ''
  if (email) {
    const role = await Role.findOne({ key: 'superadmin' })
    const existing = await User.findOne({ email })
    if (existing) console.log(`Super Administrator ${email} already exists — left unchanged.`)
    else if (password) {
      const issue = passwordIssue(password)
      if (issue) throw new Error(`SUPERADMIN_PASSWORD: ${issue}`)
      await User.create({ name: 'Super Administrator', email, role: role!._id, type: 'administrative', status: 'active', passwordHash: await hashPassword(password), activatedAt: new Date() })
      console.log(`Created Super Administrator ${email}.`)
    } else {
      // no password supplied: invite instead, so no production password is ever typed or stored
      const token = randomBytes(32).toString('base64url')
      await User.create({ name: process.env.SUPERADMIN_NAME || 'Super Administrator', email, role: role!._id, type: 'administrative', status: 'invited', tokenHash: createHash('sha256').update(token).digest('hex'), tokenPurpose: 'activate', tokenExpires: new Date(Date.now() + 7 * 86400_000), invitedAt: new Date() })
      console.log(`Invited Super Administrator ${email}. One-time activation link (valid 7 days):\n${(process.env.APP_URL ?? 'https://marq.klef.me').replace(/\/$/, '')}/activate?token=${token}`)
    }
  }
  await Promise.all(Object.values(mongoose.models).map(m => m.syncIndexes()))
  console.log(`Roles: ${DEFAULT_ROLES.length} system roles ensured. Indexes synced.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => mongoose.disconnect(), e => (console.error(e), process.exit(1)))
