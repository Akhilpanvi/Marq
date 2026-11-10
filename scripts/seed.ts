// Idempotent bootstrap: system roles + first Super Administrator. Never creates students or sample data.
// npm run seed
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
}

async function main() {
  await db()
  await seedRoles()
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD ?? ''
  if (email) {
    const issue = passwordIssue(password)
    if (issue) throw new Error(`SUPERADMIN_PASSWORD: ${issue}`)
    const role = await Role.findOne({ key: 'superadmin' })
    const existing = await User.findOne({ email })
    if (existing) console.log(`Super Administrator ${email} already exists — left unchanged.`)
    else {
      await User.create({ name: 'Super Administrator', email, role: role!._id, type: 'administrative', status: 'active', passwordHash: await hashPassword(password), activatedAt: new Date() })
      console.log(`Created Super Administrator ${email}.`)
    }
  }
  await Promise.all(Object.values(mongoose.models).map(m => m.syncIndexes()))
  console.log(`Roles: ${DEFAULT_ROLES.length} system roles ensured. Indexes synced.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => mongoose.disconnect(), e => (console.error(e), process.exit(1)))
