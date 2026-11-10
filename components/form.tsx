'use client'
import { useRef, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import type { State } from '@/lib/form'
import { toast } from './toast'

type Action = (s: State, fd: FormData) => Promise<State>

/**
 * Form bound to a server action: pending state, inline error, toast, and closes its <dialog> on success.
 * Submits via a transition so a failed submit keeps what the user typed.
 */
export function ActionForm({ action, children, className = 'space-y-4', reset = true, submit, confirm }: { action: Action; children: React.ReactNode; className?: string; reset?: boolean; submit?: string; confirm?: string }) {
  const [state, setState] = useState<State>(null)
  const [pending, start] = useTransition()
  const ref = useRef<HTMLFormElement>(null)
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={e => {
        e.preventDefault()
        if (confirm && !window.confirm(confirm)) return
        const form = e.currentTarget
        const fd = new FormData(form, (e.nativeEvent as SubmitEvent).submitter)
        start(async () => {
          const r = await action(state, fd)
          // toast from here, not an effect: revalidation may unmount this form (e.g. "Apply" becomes "Applied")
          if (r?.ok) toast(r.ok)
          else if (r?.error) toast(r.error, 'error')
          if (r?.ok && !r.secret) {
            if (reset) form.reset()
            form.closest('dialog')?.close()
          }
          setState(r)
        })
      }}
    >
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state?.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{state.error}</p>}
      {state?.secret && <Secret value={state.secret} />}
      {submit && <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : submit}</button>}
    </form>
  )
}

/** One-time value (activation link). Shown once, never stored in plain text. */
function Secret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <p className="mb-2 font-medium">Share this one-time link securely. It will not be shown again.</p>
      <div className="flex gap-2">
        <input readOnly value={value} className="input font-mono text-xs" onFocus={e => e.currentTarget.select()} />
        <button type="button" className="btn-outline" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}

/** Small inline form whose only control is a (optionally confirmed) button. */
export function ActionButton({ action, fields, children, className = 'btn-outline', confirm }: { action: Action; fields: Record<string, string>; children: React.ReactNode; className?: string; confirm?: string }) {
  return (
    <ActionForm action={action} className="inline" reset={false} confirm={confirm}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className}>{children}</button>
    </ActionForm>
  )
}

/** Native <dialog> modal. */
export function Modal({ label, title, children, className = 'btn-primary', wide }: { label: React.ReactNode; title: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className={`card m-auto w-[calc(100%-2rem)] p-0 text-fg backdrop:backdrop-blur-[1px] ${wide ? 'max-w-3xl' : 'max-w-lg'}`} onClick={e => e.target === ref.current && ref.current.close()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="btn-ghost px-2" aria-label="Close" onClick={() => ref.current?.close()}><X className="size-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </dialog>
    </>
  )
}
