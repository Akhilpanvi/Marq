import { requireUser } from '@/lib/auth'
import { User } from '@/models'
import { Card, Field, KV, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/form'
import { changePassword } from '@/app/actions/auth'
import { day } from '@/lib/format'

export const metadata = { title: 'Account' }

export default async function AccountPage() {
  const me = await requireUser()
  const u = await User.findById(me._id).lean()
  return (
    <>
      <PageHeader title="Account" description="Your sign-in details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details"><KV items={[['Name', u?.name], ['Email', u?.email], ['Role', me.roleName], ['Employee / Student ID', u?.empId], ['Department', u?.department], ['Designation', u?.designation], ['Activated', day(u?.activatedAt)], ['Last sign-in', day(u?.lastLoginAt)]]} /></Card>
        <Card title="Change password">
          <ActionForm action={changePassword} submit="Update password">
            <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className="input" /></Field>
            <Field label="New password" hint="At least 10 characters."><input name="next" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
            <Field label="Confirm new password"><input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
          </ActionForm>
        </Card>
      </div>
    </>
  )
}
