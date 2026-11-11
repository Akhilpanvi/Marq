import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth-shell'
import { ActionForm } from '@/components/form'
import { Field } from '@/components/ui'
import { changePasswordAtLogin } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Change password' }

export default function ChangePasswordPage() {
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Change password</h1>
      <p className="mt-1.5 text-sm text-muted">Students and staff: enter your current password and choose a new one. You’ll be signed in afterwards.</p>
      <ActionForm action={changePasswordAtLogin} className="mt-8 space-y-4" submit="Change password & sign in">
        <Field label="Email, username or ID"><input name="id" required autoComplete="username" className="input" /></Field>
        <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className="input" /></Field>
        <Field label="New password" hint="At least 10 characters."><input name="next" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
        <Field label="Confirm new password"><input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
      </ActionForm>
      <Link href="/login" className="mt-6 inline-block text-sm text-accent hover:underline">← Back to sign in</Link>
    </AuthShell>
  )
}
