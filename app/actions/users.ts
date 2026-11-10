'use server'
import { revalidatePath } from 'next/cache'
import { audit, guard, type Me } from '@/lib/auth'
import { attempt, EMAIL, Invalid, need, oid, oneOf, str, type State } from '@/lib/form'
import { ACCOUNT_TYPES, ALL_PERMS, hasPerm, type Perm } from '@/lib/rbac'
import { issueLink } from '@/lib/tokens'
import { Role, User } from '@/models'

/** No privilege escalation: you can only grant a role whose permissions you hold yourself. */
async function assignable(me: Me, roleId: string) {
  const role = await Role.findById(roleId).lean()
  if (!role) throw new Invalid('Choose a valid role.')
  const perms = role.perms.includes('*') ? ['*', ...ALL_PERMS] : role.perms
  if (!perms.every(p => hasPerm(me.perms, p as Perm))) throw new Invalid(`You cannot assign the ${role.name} role: it has permissions you don't hold.`)
  if (role.scope === 'all' && me.scope === 'assigned') throw new Invalid('You cannot assign a programme-wide role.')
  return role
}

export async function saveUser(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const id = oid(fd, 'id')
    const me = await guard(id ? 'users.edit' : 'users.create')
    const email = need(fd, 'email', 'Email', 120).toLowerCase()
    if (!EMAIL.test(email)) throw new Invalid('Enter a valid email address.')
    const roleId = oid(fd, 'role')
    if (!roleId) throw new Invalid('Choose a role.')
    const role = await assignable(me, roleId)
    const set = {
      name: need(fd, 'name', 'Full name', 120), email,
      empId: str(fd, 'empId', 30).toUpperCase() || undefined,
      phone: str(fd, 'phone', 20), department: str(fd, 'department', 80), designation: str(fd, 'designation', 80),
      type: oneOf(fd, 'type', ACCOUNT_TYPES, 'administrative'), role: role._id,
    }
    if (id) {
      const before = await User.findById(id).select('name email empId role type department designation phone student').lean()
      if (!before) throw new Invalid('User not found.')
      if (String(before._id) === String(me._id) && String(before.role) !== String(role._id)) throw new Invalid('You cannot change your own role.')
      await assignable(me, String(before.role)) // can't edit someone more privileged than you
      if (before.student && role.portal !== 'student') throw new Invalid('Student portal accounts must keep a student-portal role.')
      // empId has a sparse unique index: unset it rather than storing null
      const { empId, ...rest } = set
      await User.updateOne({ _id: id }, empId ? { $set: { ...rest, empId } } : { $set: rest, $unset: { empId: 1 } })
      if (String(before.role) !== String(role._id)) await User.updateOne({ _id: id }, { $inc: { sessionVersion: 1 } }) // re-login with new permissions
      await audit(me, 'users', String(before.role) !== String(role._id) ? 'user.roleChange' : 'user.update', id, before, set)
      revalidatePath('/users')
      return { ok: 'User updated.' }
    }
    if (role.portal === 'student') throw new Invalid('Student accounts are created from the Students list so they are linked to a student record.')
    const u = await User.create({ ...set, status: 'invited', createdBy: me._id })
    const link = await issueLink(u, 'activate')
    await audit(me, 'users', 'user.create', u._id, undefined, { email, role: role.key })
    revalidatePath('/users')
    return link ? { ok: 'Account created. Email is not configured — share the activation link below.', secret: link } : { ok: 'Account created and activation email sent.' }
  })
}

export async function setUserStatus(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('users.edit')
    const id = oid(fd, 'id')
    const active = fd.get('active') === '1'
    if (String(id) === String(me._id)) throw new Invalid('You cannot deactivate your own account.')
    const u = await User.findById(id).select('status role name email').lean()
    if (!u) throw new Invalid('User not found.')
    await assignable(me, String(u.role))
    const status = active ? (u.status === 'inactive' ? 'active' : u.status) : 'inactive'
    // reactivating someone who never activated puts them back to invited
    const next = active && status === 'active' && !(await User.exists({ _id: id, passwordHash: { $exists: true } })) ? 'invited' : status
    await User.updateOne({ _id: id }, { $set: { status: next }, $inc: { sessionVersion: 1 } })
    await audit(me, 'users', active ? 'user.reactivate' : 'user.deactivate', id, { status: u.status }, { status: next })
    revalidatePath('/users')
    return { ok: active ? `${u.name} reactivated.` : `${u.name} deactivated and signed out everywhere.` }
  })
}

/** Activation link for invited accounts, reset link for active ones. Never reveals or sets a password. */
export async function sendLink(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('users.edit')
    const u = await User.findById(oid(fd, 'id')).select('name email status role').lean()
    if (!u) throw new Invalid('User not found.')
    if (u.status === 'inactive') throw new Invalid('Reactivate the account first.')
    await assignable(me, String(u.role))
    const purpose = u.status === 'invited' ? 'activate' : 'reset'
    const link = await issueLink(u, purpose)
    await audit(me, 'users', purpose === 'activate' ? 'user.invite' : 'user.resetLink', u._id)
    revalidatePath('/users')
    return link ? { ok: `${purpose === 'activate' ? 'Activation' : 'Reset'} link generated for ${u.email}.`, secret: link } : { ok: `${purpose === 'activate' ? 'Activation' : 'Reset'} email sent to ${u.email}.` }
  })
}
