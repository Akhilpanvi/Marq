// Idempotent bootstrap: system roles + first Super Administrator. Never creates students or sample data.
// npm run seed
import { createHash, randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import { db } from '../lib/db'
import { hashPassword, passwordIssue } from '../lib/password'
import { DEFAULT_ROLES } from '../lib/rbac'
import { Batch, DailyRegister, Program, Role, Setting, Student, User } from '../models'

export async function seedRoles() {
  for (const r of DEFAULT_ROLES)
    await Role.updateOne(
      { key: r.key },
      { $setOnInsert: { key: r.key, perms: r.perms }, $set: { name: r.name, description: r.description, scope: r.scope, portal: r.portal ?? null, system: true } },
      { upsert: true },
    )
  // superadmin always keeps full control, even if someone edited it
  await Role.updateOne({ key: 'superadmin' }, { $set: { perms: ['*'] } })
  await migrate()
  // permissions added to built-in roles after first release (idempotent)
  for (const [key, perms] of Object.entries(ADDED_PERMS)) await Role.updateOne({ key }, { $addToSet: { perms: { $each: perms } } })
  // Finance module removed (Nov 2026): drop its permissions and the Director Accounts role if nobody holds it
  const fin = await Role.find({ perms: { $regex: '^finance\\.' } }).select('_id perms').lean()
  for (const r of fin) await Role.updateOne({ _id: r._id }, { $set: { perms: r.perms.filter(p => !p.startsWith('finance.')) } })
  const da = await Role.findOne({ key: 'director_accounts' }).lean()
  if (da && !(await User.exists({ role: da._id }))) await Role.deleteOne({ _id: da._id })
}

/** Daily register (Nov 2026): assistants post attendance, the Director approves changes. */
const ADDED_PERMS: Record<string, string[]> = {}

/** One-time data migrations, recorded in Settings so they never run twice (later edits in Roles are kept). */
const MIGRATIONS: { id: string; run: () => Promise<void> }[] = [
  {
    // the current cohort is batch "A"; the daily register is now marked per batch (one register per batch per day)
    id: '2026-11-batch-a',
    run: async () => {
      await DailyRegister.collection.dropIndex('day_1').catch(() => {})
      await DailyRegister.collection.createIndex({ day: 1, batch: 1 }, { unique: true })
      const unassigned = { demo: { $ne: true }, $or: [{ batch: null }, { batch: { $exists: false } }] }
      if (!(await Student.exists(unassigned))) return console.log('  batch A: no unassigned students — nothing to do')
      const program = (await Program.findOne().sort({ createdAt: 1 })) ?? (await Program.create({ name: 'Top Notch Marquee 2026', status: 'running' }))
      const a = (await Batch.findOne({ name: 'A' })) ?? (await Batch.create({ name: 'A', program: program._id }))
      const r = await Student.updateMany(unassigned, { $set: { batch: a._id } })
      await DailyRegister.updateMany({ batch: { $exists: false } }, { $set: { batch: a._id } })
      console.log(`  batch A: ${r.modifiedCount} student(s) assigned`)
    },
  },
  {
    // interview scheduling was removed: drop its permissions from stored roles
    id: '2026-11-remove-interviews',
    run: async () => {
      const r = await Role.updateMany({}, { $pull: { perms: { $regex: '^interviews\\.' } } })
      console.log(`  removed interview permissions from ${r.modifiedCount} role(s)`)
    },
  },
  {
    // profile pictures are links now (Google Drive, else GitHub avatar): drop stored image bytes to free storage
    id: '2026-11-photos-as-links',
    run: async () => {
      const r = await Student.collection.updateMany({ photo: { $exists: true } }, { $unset: { photo: '' } })
      console.log(`  removed stored photos from ${r.modifiedCount} student(s)`)
    },
  },
  {
    // Administrator, Admin Assistant and Placement Administrator become one role: Placement Admin
    id: '2026-11-merge-placement-admin',
    run: async () => {
      const def = DEFAULT_ROLES.find(r => r.key === 'placement_admin')!
      const target = await Role.findOneAndUpdate({ key: 'placement_admin' }, { $set: { name: def.name, description: def.description, perms: def.perms, scope: 'all', system: true } }, { upsert: true, returnDocument: 'after' })
      const old = await Role.find({ key: { $in: ['admin', 'admin_assistant'] } }).select('_id').lean()
      await User.updateMany({ role: { $in: old.map(r => r._id) } }, { $set: { role: target!._id }, $inc: { sessionVersion: 1 } })
      await Role.deleteMany({ _id: { $in: old.map(r => r._id) } })
      await User.updateMany({ role: target!._id }, { $inc: { sessionVersion: 1 } })
    },
  },
  {
    id: '2026-11-director-full-access',
    run: async () => {
      const def = DEFAULT_ROLES.find(r => r.key === 'director')!
      const d = await Role.findOneAndUpdate({ key: 'director' }, { $set: { perms: def.perms, description: def.description } }, { returnDocument: 'after' })
      if (d) await User.updateMany({ role: d._id }, { $inc: { sessionVersion: 1 } })
    },
  },
]

async function migrate() {
  for (const m of MIGRATIONS) {
    if (await Setting.exists({ key: `migration:${m.id}` })) continue
    await m.run()
    await Setting.create({ key: `migration:${m.id}`, value: new Date() })
    console.log(`Migration applied: ${m.id}`)
  }
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
