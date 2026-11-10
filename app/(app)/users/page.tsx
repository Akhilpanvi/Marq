import Link from 'next/link'
import { Plus } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { ACCOUNT_TYPES } from '@/lib/rbac'
import { roleOptions } from '@/lib/options'
import { ago, day } from '@/lib/format'
import { OID } from '@/lib/form'
import { AuditLog, Role, User } from '@/models'
import { Avatar, Badge, Card, Field, PageHeader, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { saveUser, sendLink, setUserStatus } from '@/app/actions/users'

export const metadata = { title: 'User Management' }

type U = { _id?: unknown; name?: string; email?: string; empId?: string | null; phone?: string | null; department?: string | null; designation?: string | null; type?: string | null; role?: unknown }
function UserFields({ u = {}, roles }: { u?: U; roles: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {u._id ? <input type="hidden" name="id" value={String(u._id)} /> : null}
      <Field label="Full name *"><input name="name" required defaultValue={u.name} className="input" /></Field>
      <Field label="Email *"><input name="email" type="email" required defaultValue={u.email} className="input" /></Field>
      <Field label="Employee / Student ID"><input name="empId" defaultValue={u.empId ?? ''} className="input uppercase" /></Field>
      <Field label="Mobile number"><input name="phone" type="tel" defaultValue={u.phone ?? ''} className="input" /></Field>
      <Field label="Department"><input name="department" defaultValue={u.department ?? ''} className="input" /></Field>
      <Field label="Designation"><input name="designation" defaultValue={u.designation ?? ''} className="input" /></Field>
      <Field label="Account type">
        <select name="type" defaultValue={u.type ?? 'administrative'} className="input">{ACCOUNT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}</select>
      </Field>
      <Field label="Role *">
        <select name="role" required defaultValue={u.role ? String(u.role) : ''} className="input"><option value="">Choose…</option>{roles.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
    </div>
  )
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('users.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), role = sp(params, 'role'), status = sp(params, 'status'), type = sp(params, 'type'), edit = sp(params, 'edit')
  const filter: Record<string, unknown> = {}
  if (q) filter.$or = [{ name: new RegExp(escapeRe(q), 'i') }, { email: new RegExp(escapeRe(q), 'i') }, { empId: new RegExp(escapeRe(q), 'i') }]
  if (role) filter.role = role
  if (status) filter.status = status
  if (type) filter.type = type
  const [users, total, roles, editing] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).populate('createdBy', 'name').lean(),
    User.countDocuments(filter),
    roleOptions(),
    OID.test(edit) && can(me, 'users.edit') ? User.findById(edit).lean() : null,
  ])
  const roleName = new Map(roles)
  const staffRoles = (await Role.find({ portal: null }).select('_id').lean()).map(r => String(r._id))
  const history = await AuditLog.find({ module: 'users' }).sort({ at: -1 }).limit(8).lean()
  const canEdit = can(me, 'users.edit')

  return (
    <>
      <PageHeader title="User Management" description="Administrative, faculty, mentor, trainer and student accounts. Passwords are never visible — users set their own through one-time links.">
        {can(me, 'users.create') && (
          <Modal label={<><Plus className="size-4" />New account</>} title="Create account" wide>
            <ActionForm action={saveUser} submit="Create & invite"><UserFields roles={roles.filter(([v]) => staffRoles.includes(v))} /></ActionForm>
            <p className="mt-3 text-xs text-muted">Student accounts are created from Students → select → “Create accounts &amp; invite”, so each is linked to its student record.</p>
          </Modal>
        )}
      </PageHeader>

      {editing && (
        <Card title={`Edit ${editing.name}`} className="mb-6" action={<Link href="/users" className="btn-ghost">Close</Link>}>
          <ActionForm action={saveUser} submit="Save changes" reset={false}><UserFields u={editing} roles={roles} /></ActionForm>
        </Card>
      )}

      <Card pad={false}>
        <Filters params={params} placeholder="Search name, email or ID">
          <Select name="role" value={role} options={roles} all="All roles" />
          <Select name="type" value={type} options={[...ACCOUNT_TYPES]} all="All types" />
          <Select name="status" value={status} options={[['active', 'Active'], ['invited', 'Invited'], ['inactive', 'Inactive']]} all="All statuses" />
        </Filters>
        <Table head={['User', 'ID', 'Role', 'Type', 'Status', 'Last login', 'Created', '']}>
          {users.map(u => (
            <tr key={String(u._id)}>
              <td className="td"><div className="flex items-center gap-2.5"><Avatar name={u.name} size="size-8" /><div className="min-w-0"><div className="truncate font-medium">{u.name}</div><div className="truncate text-xs text-muted">{u.email}</div></div></div></td>
              <td className="td font-mono text-xs">{u.empId ?? '—'}</td>
              <td className="td">{roleName.get(String(u.role)) ?? '—'}</td>
              <td className="td capitalize text-muted">{u.type}</td>
              <td className="td"><Badge tone={u.status === 'active' ? 'green' : u.status === 'invited' ? 'amber' : 'zinc'}>{u.status}</Badge></td>
              <td className="td text-muted">{ago(u.lastLoginAt)}</td>
              <td className="td text-xs text-muted">{day(u.createdAt)}{u.createdBy ? <div>by {(u.createdBy as unknown as { name: string }).name}</div> : null}</td>
              <td className="td">
                {canEdit && String(u._id) !== String(me._id) && (
                  <div className="flex justify-end gap-1">
                    <Link className="btn-ghost px-2 py-1 text-xs" href={`/users?edit=${u._id}`}>Edit</Link>
                    {u.status !== 'inactive' && <ActionButton action={sendLink} fields={{ id: String(u._id) }} className="btn-ghost px-2 py-1 text-xs">{u.status === 'invited' ? 'Invite link' : 'Reset link'}</ActionButton>}
                    <ActionButton action={setUserStatus} fields={{ id: String(u._id), active: u.status === 'inactive' ? '1' : '0' }} className="btn-ghost px-2 py-1 text-xs" confirm={u.status === 'inactive' ? undefined : `Deactivate ${u.name}? They will be signed out immediately.`}>{u.status === 'inactive' ? 'Reactivate' : 'Deactivate'}</ActionButton>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/users" />
      </Card>

      <Card title="Recent account activity" className="mt-6">
        <ul className="space-y-2 text-sm">
          {history.map(h => <li key={String(h._id)} className="flex justify-between gap-4"><span><b>{h.actorName}</b> · {h.action}</span><span className="text-xs text-muted">{ago(h.at)}</span></li>)}
          {!history.length && <li className="text-muted">No account activity yet.</li>}
        </ul>
      </Card>
    </>
  )
}
