import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Check, LogOut } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { onboardingState, REQUIRED_SKILLS } from '@/lib/onboarding'
import { PLATFORMS } from '@/lib/coding-points'
import { logout } from '@/app/actions/auth'
import { onboardCoding, onboardProfile } from '@/app/actions/signup'
import { ActionForm } from '@/components/form'
import { Field } from '@/components/ui'
import { KlSeal, MarqWordmark } from '@/components/logo'
import { ThemeToggle } from '@/components/theme'

export const metadata: Metadata = { title: 'Complete your profile' }

const Step = ({ n, label, state }: { n: number; label: string; state: 'done' | 'now' | 'next' }) => (
  <li className="flex items-center gap-2 text-sm">
    <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'now' ? 'bg-accent text-white' : 'bg-subtle text-muted'}`}>{state === 'done' ? <Check className="size-3.5" /> : n}</span>
    <span className={state === 'next' ? 'text-muted' : 'font-medium'}>{label}</span>
  </li>
)

export default async function Onboarding() {
  const me = await requireStudent()
  const st = await onboardingState(me.student)
  if (!st) redirect('/login')
  if (st.done) redirect('/me')
  const { s, stats } = st
  const step = st.codingDone ? 2 : 1
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <span className="flex items-center gap-2.5"><KlSeal className="size-8" /><MarqWordmark className="h-4 w-auto" /></span>
        <div className="flex items-center"><ThemeToggle /><form action={logout}><button className="btn-ghost px-2" aria-label="Sign out"><LogOut className="size-4" /></button></form></div>
      </header>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome, {s.name.split(' ')[0]}</h1>
      <p className="mt-1 text-sm text-muted">Two quick steps before your MARQ dashboard opens. Both are required.</p>
      <ol className="my-6 flex flex-wrap gap-x-6 gap-y-2"><Step n={1} label="Account" state="done" /><Step n={2} label="Coding profiles" state={step === 1 ? 'now' : 'done'} /><Step n={3} label="Profile" state={step === 2 ? 'now' : 'next'} /></ol>

      {step === 1 ? (
        <section className="card p-5">
          <h2 className="font-semibold">Coding profiles</h2>
          <p className="mt-1 text-sm text-muted">Usernames only. We check that each account exists and read public profile data. Codeforces is optional.</p>
          <ActionForm action={onboardCoding} className="mt-4 space-y-4" submit="Verify & continue" reset={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['leetcode', 'codechef', 'codeforces'] as const).map(p => (
                <Field key={p} label={`${PLATFORMS[p].label}${p === 'codeforces' ? ' (optional)' : ' *'}`} hint={stats.get(p)?.status === 'not_found' ? 'Not found — check the username' : undefined}>
                  <input name={p} defaultValue={s.handles?.[p] ?? ''} required={p !== 'codeforces'} maxLength={40} autoComplete="off" className="input" />
                </Field>
              ))}
              <Field label="GitHub *"><input name="github" defaultValue={s.handles?.github ?? ''} required maxLength={40} autoComplete="off" className="input" /></Field>
            </div>
          </ActionForm>
        </section>
      ) : (
        <section className="card p-5">
          <h2 className="font-semibold">Your profile</h2>
          <p className="mt-1 text-sm text-muted">Recruiters and mentors see this. Links must be viewable by anyone with the link.</p>
          <ActionForm action={onboardProfile} className="mt-4 space-y-4" submit="Finish & open MARQ" reset={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile number *"><input name="phone" type="tel" required defaultValue={s.phone ?? ''} className="input" /></Field>
              <Field label="Personal email *"><input name="personalEmail" type="email" required defaultValue={s.personalEmail ?? ''} className="input" /></Field>
              <Field label="Headline *" className="sm:col-span-2"><input name="headline" required maxLength={140} defaultValue={s.professional?.headline ?? ''} placeholder="Aspiring backend engineer · Java, Spring, SQL" className="input" /></Field>
              <Field label="LinkedIn *"><input name="linkedin" type="url" required defaultValue={s.professional?.linkedin ?? ''} placeholder="https://linkedin.com/in/…" className="input" /></Field>
              <Field label="Resume link *"><input name="resume" type="url" required defaultValue={s.professional?.resume ?? ''} placeholder="https://drive.google.com/…" className="input" /></Field>
              <Field label="GitHub profile link"><input name="githubUrl" type="url" defaultValue={s.professional?.github ?? (s.handles?.github ? `https://github.com/${s.handles.github}` : '')} className="input" /></Field>
              <Field label="Portfolio"><input name="portfolio" type="url" defaultValue={s.professional?.portfolio ?? ''} className="input" /></Field>
              <Field label={`Skills * (at least ${REQUIRED_SKILLS}, comma separated)`} className="sm:col-span-2"><input name="skills" required defaultValue={(s.professional?.skills ?? []).join(', ')} placeholder="Java, DSA, SQL, React" className="input" /></Field>
            </div>
          </ActionForm>
        </section>
      )}
    </main>
  )
}
