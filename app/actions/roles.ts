'use server'
import { revalidatePath } from 'next/cache'
import { audit, guard } from '@/lib/auth'
import { attempt, Invalid, need, oneOf, str, type State } from '@/lib/form'
import { ALL_PERMS, hasPerm, type Perm } from '@/lib/rbac'
import { Role, User } from '@/models'

export async function saveRole(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const existing = str(fd, 'existing', 40)
    const me = await guard(existing ? 'roles.edit' : 'roles.create')
    const perms = fd.getAll('perms').map(String).filter(p => (ALL_PERMS as string[]).includes(p))
    if (!perms.every(p => hasPerm(me.perms, p as Perm))) throw new Invalid('You cannot grant permissions you do not hold.')
    const name = need(fd, 'name', 'Role name', 60)
    const scope = oneOf(fd, 'scope', ['all', 'assigned'] as const, 'all')
    const description = str(fd, 'description', 200)
    if (existing) {
      const before = await Role.findOne({ key: existing }).lean()
      if (!before) throw new Invalid('Role not found.')
      if (before.key === 'superadmin') throw new Invalid('The Super Administrator role always has full control and cannot be edited.')
      if (before.portal === 'student' && perms.length) throw new Invalid('The Student role is a portal role and cannot hold administrative permissions.')
      await Role.updateOne({ _id: before._id }, { $set: { perms, scope, description, ...(before.system ? {} : { name }) } })
      await User.updateMany({ role: before._id }, { $inc: { sessionVersion: 1 } }) // permissions take effect on next sign-in
      await audit(me, 'roles', 'role.update', before.key, { perms: before.perms, scope: before.scope }, { perms, scope })
      revalidatePath('/roles')
      return { ok: `${before.name} updated. Members will sign in again to pick up the change.` }
    }
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
    if (!key) throw new Invalid('Role name needs letters or digits.')
    if (await Role.exists({ key })) throw new Invalid('A role with this name already exists.')
    await Role.create({ key, name, description, perms, scope, system: false })
    await audit(me, 'roles', 'role.create', key, undefined, { perms, scope })
    revalidatePath('/roles')
    return { ok: `Role ${name} created.` }
  })
}

export async function deleteRole(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('roles.delete')
    const role = await Role.findOne({ key: str(fd, 'key', 40) }).lean()
    if (!role) throw new Invalid('Role not found.')
    if (role.system) throw new Invalid('Built-in roles cannot be deleted.')
    if (await User.exists({ role: role._id })) throw new Invalid('Move this role’s users to another role first.')
    await Role.deleteOne({ _id: role._id })
    await audit(me, 'roles', 'role.delete', role.key, role)
    revalidatePath('/roles')
    return { ok: `Role ${role.name} deleted.` }
  })
}
