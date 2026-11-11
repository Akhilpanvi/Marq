import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth-shell'
import { RegisterSteps } from './steps'

export const metadata: Metadata = { title: 'Student registration' }

export default function RegisterPage() {
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Student registration</h1>
      <p className="mt-1.5 text-sm text-muted">For Top Notch Marquee students only. Use the university email the programme office has on record.</p>
      <RegisterSteps />
      <p className="mt-6 text-xs text-muted">Already registered? <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link></p>
    </AuthShell>
  )
}
