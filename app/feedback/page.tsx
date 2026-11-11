import type { Metadata } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/auth'
import { AuthShell } from '@/components/auth-shell'
import { ActionForm } from '@/components/form'
import { Field } from '@/components/ui'
import { sendFeedback } from '@/app/actions/feedback'

export const metadata: Metadata = { title: 'Feedback' }

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const me = await currentUser()
  const { from } = await searchParams
  return (
    <AuthShell>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Feedback</h1>
      <p className="mt-1.5 text-sm text-muted">Suggestions, problems or questions about MARQ — the programme team reads every message.</p>
      <ActionForm action={sendFeedback} className="mt-8 space-y-4" submit="Send feedback">
        <input type="hidden" name="page" value={from ?? ''} />
        {me ? (
          <div className="rounded-lg border border-line bg-subtle/60 p-3 text-sm">
            <div className="text-xs text-muted">Sending as</div>
            <div className="font-medium">{me.name}</div>
            <div className="text-muted">{me.email} · {me.roleName}</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *"><input name="name" required maxLength={120} autoComplete="name" className="input" /></Field>
            <Field label="Email *"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
            <Field label="I am a…" className="sm:col-span-2"><select name="role" className="input"><option>Student</option><option>Faculty / Staff</option><option>Recruiter</option><option>Visitor</option></select></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type"><select name="category" className="input">{['Suggestion', 'Bug', 'Question', 'Praise', 'Other'].map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Rating"><select name="rating" className="input"><option value="">—</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></Field>
        </div>
        <Field label="Message *"><textarea name="message" required minLength={5} maxLength={3000} rows={5} className="input" /></Field>
      </ActionForm>
      <Link href={me ? '/' : '/login'} className="mt-6 inline-block text-sm text-accent hover:underline">← Back to {me ? 'MARQ' : 'sign in'}</Link>
    </AuthShell>
  )
}
