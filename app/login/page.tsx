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
      <div className="mt-6 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <Link href="/change-password" className="font-medium text-accent hover:underline">Change password</Link>
        {mailEnabled() ? <Link href="/forgot-password" className="font-medium text-accent hover:underline">Forgot your password?</Link> : <span>Forgot it? Ask the programme office for a reset link.</span>}
      </div>
      <p className="mt-6 rounded-lg border border-line bg-surface p-3 text-sm">Top Notch student? <Link href="/register" className="font-medium text-accent hover:underline">Register with your university email</Link></p>
      <p className="mt-4 text-xs text-muted">Something not working? <Link href="/feedback" className="font-medium text-accent hover:underline">Send feedback</Link></p>
    </AuthShell>
  )
}
