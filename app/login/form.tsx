'use client'
import { useActionState, useTransition } from 'react'
import { login } from '@/app/actions/auth'

export function LoginForm() {
  const [state, run, pending] = useActionState(login, null)
  const [, start] = useTransition()
  return (
    <form onSubmit={e => (e.preventDefault(), start(() => run(new FormData(e.currentTarget))))} className="mt-8 space-y-4">
      <label className="block">
        <span className="label">Email or Employee ID</span>
        <input name="id" required maxLength={120} autoComplete="username" autoFocus className="input" placeholder="name@kluniversity.in" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
