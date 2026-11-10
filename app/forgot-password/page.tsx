import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth-shell'
import { ActionForm } from '@/components/form'
import { Field } from '@/components/ui'
import { requestReset } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Reset password' }

export default function ForgotPage() {
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">We&apos;ll email a link to the address on your account.</p>
      <ActionForm action={requestReset} className="mt-8 space-y-4" submit="Send reset link">
        <Field label="Email"><input name="id" type="email" required className="input" /></Field>
      </ActionForm>
      <Link href="/login" className="mt-6 inline-block text-sm text-accent hover:underline">← Back to sign in</Link>
    </AuthShell>
  )
}
