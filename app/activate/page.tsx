import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth-shell'
import { ActionForm } from '@/components/form'
import { Field } from '@/components/ui'
import { redeemToken } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Set your password' }

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Set your password</h1>
      <p className="mt-1.5 text-sm text-muted">Choose a password of at least 10 characters. This link works once.</p>
      <ActionForm action={redeemToken} className="mt-8 space-y-4" submit="Set password & continue">
        <input type="hidden" name="token" value={token} />
        <Field label="New password"><input name="next" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
        <Field label="Confirm password"><input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" /></Field>
      </ActionForm>
    </AuthShell>
  )
}
