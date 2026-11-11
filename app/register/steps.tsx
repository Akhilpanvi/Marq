'use client'
import { useState, useTransition } from 'react'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { checkRegistration, registerStudent } from '@/app/actions/signup'

type Found = { name: string; regNo: string; department: string; specialization: string; email: string }

/** 1 email → 2 confirm details → 3 email sent. */
export function RegisterSteps() {
  const [email, setEmail] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [done, setDone] = useState<{ ok: string; secret?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const fd = () => { const f = new FormData(); f.set('email', email); return f }

  if (done)
    return (
      <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm" role="status">
        <MailCheck className="mb-2 size-5 text-emerald-600" />
        <p className="font-medium">{done.ok}</p>
        <p className="mt-2 text-muted">Open the email from MARQ · KL University, click <b>Activate account</b>, and choose your password. Then you’ll add your coding profiles and complete your profile.</p>
        {done.secret && <p className="mt-3 break-all font-mono text-xs"><a href={done.secret} className="text-accent underline">{done.secret}</a></p>}
      </div>
    )

  return (
    <div className="mt-8 space-y-4">
      {!found ? (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); setError(null); start(async () => { const r = await checkRegistration(null, fd()); r?.error ? setError(r.error) : setFound(r!.data as Found) }) }}>
          <label className="block"><span className="label">University email</span>
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="2300030001@kluniversity.in" className="input" autoComplete="email" />
          </label>
          <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? 'Checking…' : 'Continue'}</button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-emerald-600" />Is this you?</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">Name</dt><dd className="font-medium">{found.name}</dd>
              <dt className="text-muted">Student ID</dt><dd className="font-mono">{found.regNo}</dd>
              <dt className="text-muted">Branch</dt><dd>{[found.department, found.specialization].filter(Boolean).join(' · ') || '—'}</dd>
              <dt className="text-muted">Email</dt><dd>{found.email}</dd>
            </dl>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => { setFound(null); setError(null) }}>Not me</button>
            <button type="button" className="btn-primary flex-1" disabled={pending} onClick={() => { setError(null); start(async () => { const r = await registerStudent(null, fd()); r?.error ? setError(r.error) : setDone({ ok: r!.ok!, secret: r!.secret }) }) }}>{pending ? 'Sending…' : 'Register'}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  )
}
