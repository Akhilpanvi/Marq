import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth-shell'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { mailEnabled } from '@/lib/mail'
import { LoginForm } from './form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await currentUser()) redirect('/')
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted">Use the account issued by the Marquee programme office. There is no public sign-up.</p>
      <LoginForm />
      <p className="mt-6 text-xs text-muted">
        {mailEnabled() ? <Link href="/forgot-password" className="font-medium text-accent hover:underline">Forgot your password?</Link> : 'Forgot your password? Ask the programme office for a reset link.'}
      </p>
    </AuthShell>
  )
}
