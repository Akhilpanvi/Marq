import Link from 'next/link'
import { Plus, Lock } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { ACTIONS, MODULES } from '@/lib/rbac'
import { Role, User } from '@/models'
import { Badge, Card, Field, PageHeader, Table } from '@/components/ui'
import { ActionButton, ActionForm } from '@/components/form'
import { deleteRole, saveRole } from '@/app/actions/roles'

export const metadata = { title: 'Roles & Permissions' }

type R = { key?: string; name?: string; description?: string | null; perms?: string[]; scope?: string | null; system?: boolean | null; portal?: string | null }

function Matrix({ r = {}, disabled }: { r?: R; disabled?: boolean }) {
  const all = r.perms?.includes('*')
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-subtle/60"><tr><th className="th">Module</th>{Object.values(ACTIONS).map(a => <th key={a} className="th text-center">{a}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">
          {Object.entries(MODULES).map(([m, label]) => (
            <tr key={m}>
              <td className="td font-medium">{label}</td>
              {Object.keys(ACTIONS).map(a => (
                <td key={a} className="td text-center">
                  <input type="checkbox" name="perms" value={`${m}.${a}`} defaultChecked={all || r.perms?.includes(`${m}.${a}`)} disabled={disabled} aria-label={`${label}: ${a}`} className="size-4 accent-brand-600" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoleForm({ r }: { r?: R }) {
  const locked = r?.key === 'superadmin' || r?.portal === 'student'
  return (
    <ActionForm action={saveRole} submit={locked ? undefined : r ? 'Save permissions' : 'Create role'} reset={!r}>
      {r && <input type="hidden" name="existing" value={r.key} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Role name"><input name="name" required defaultValue={r?.name} readOnly={!!r?.system} className="input read-only:text-muted" /></Field>
        <Field label="Description" className="sm:col-span-2"><input name="description" defaultValue={r?.description ?? ''} className="input" /></Field>
        <Field label="Data scope" hint="Assigned = only their mentees and the batches they train.">
          <select name="scope" defaultValue={r?.scope ?? 'all'} className="input" disabled={locked}><option value="all">Whole programme</option><option value="assigned">Assigned students only</option></select>
        </Field>
      </div>
      {locked ? <p className="flex items-center gap-2 text-sm text-muted"><Lock className="size-4" />{r?.key === 'superadmin' ? 'Super Administrator always has every permission.' : 'Students only use their own portal; they hold no administrative permissions.'}</p> : <Matrix r={r} />}
    </ActionForm>
  )
}

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const me = await requirePage('roles.view')
  const { edit, new: isNew } = await searchParams
  const [roles, counts] = await Promise.all([Role.find().sort({ system: -1, name: 1 }).lean(), User.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: '$role', n: { $sum: 1 } } }])])
  const count = new Map(counts.map(c => [String(c._id), c.n]))
  const editing = edit ? roles.find(r => r.key === edit) : null

  return (
    <>
      <PageHeader title="Roles & Permissions" description="Every page and API checks these permissions on the server. Hiding a button is never the only protection.">
        {can(me, 'roles.create') && <Link className="btn-primary" href="/roles?new=1"><Plus className="size-4" />New role</Link>}
      </PageHeader>
      {(editing || (isNew && can(me, 'roles.create'))) && (
        <Card title={editing ? `${editing.name} permissions` : 'New role'} className="mb-6" action={<Link className="btn-ghost" href="/roles">Close</Link>}>
          {can(me, editing ? 'roles.edit' : 'roles.create') ? <RoleForm r={editing ?? undefined} /> : <Matrix r={editing ?? undefined} disabled />}
        </Card>
      )}
      <Card pad={false}>
        <Table head={['Role', 'Scope', 'Permissions', 'Users', '']}>
          {roles.map(r => (
            <tr key={r.key}>
              <td className="td"><div className="font-medium">{r.name} {r.system && <Badge>built-in</Badge>}</div><div className="text-xs text-muted">{r.description}</div></td>
              <td className="td">{r.portal ? 'Own record' : r.scope === 'assigned' ? 'Assigned students' : 'Whole programme'}</td>
              <td className="td text-muted">{r.perms.includes('*') ? 'All' : r.perms.length}</td>
              <td className="td tabular-nums">{count.get(String(r._id)) ?? 0}</td>
              <td className="td"><div className="flex justify-end gap-1">
                <Link className="btn-ghost px-2 py-1 text-xs" href={`/roles?edit=${r.key}`}>{can(me, 'roles.edit') ? 'Edit' : 'View'}</Link>
                {!r.system && can(me, 'roles.delete') && <ActionButton action={deleteRole} fields={{ key: r.key }} className="btn-ghost px-2 py-1 text-xs text-red-600" confirm={`Delete role ${r.name}?`}>Delete</ActionButton>}
              </div></td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
