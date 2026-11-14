'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'
import { setDriveStatus } from '@/app/actions/placement'
import { DRIVE_GROUPS, NUDGE_DAYS, OFFERED, daysSince, driveChoice, driveChoicesFor, isWaiting } from '@/lib/placement'
import { toast } from './toast'

type Hist = { to?: string; at?: string; remarks?: string }
type Props = { job: string; company: string; role: string; status?: string; updatedAt?: string; history?: Hist[] }

const ago = (n: number) => (n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`)
const dm = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '')
const NEXT: Record<string, string> = {
  going: 'We’ll remind you in a week to update this if you’re still waiting.',
  out: 'Thanks for letting us know — keep going with the other drives!',
  offer: 'The placement team will contact you to verify your offer.',
  Accepted: 'Congratulations! The placement team will update your placement record.',
  Declined: 'Thanks for letting us know — the placement team will see this.',
  none: 'No problem.',
}

export function DriveStatus({ job, company, role, status, updatedAt, history = [] }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'choose' | 'review' | 'done'>('choose')
  const [pick, setPick] = useState<string | undefined>(status)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [pending, start] = useTransition()

  const cur = driveChoice(status)
  const days = daysSince(updatedAt)
  const nudge = isWaiting(status) && days >= NUDGE_DAYS
  const choices = driveChoicesFor(status)
  const chosen = driveChoice(pick)
  const same = !!pick && pick === status && !note.trim()
  // The double-check is only for a new offer; adding a note to an offer already on record needs no re-confirmation.
  const isOffer = pick === 'Offered' && !OFFERED.includes(status ?? '')

  const open = () => {
    setStep('choose'); setPick(status); setNote(''); setConfirm(false); setError(''); setResult('')
    ref.current?.showModal()
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role=radio][tabindex="0"]')?.focus())
  }
  useEffect(() => {
    if (step === 'choose' && ref.current?.open) ref.current.querySelector<HTMLElement>('[role=radio][tabindex="0"]')?.focus()
  }, [step])

  const save = () => start(async () => {
    setError('')
    const fd = new FormData()
    fd.set('job', job)
    fd.set('status', pick ?? '')
    if (note.trim()) fd.set('remarks', note.trim())
    if (isOffer) fd.set('confirmOffer', 'yes')
    const r = await setDriveStatus(null, fd)
    if (r?.error) { setError(r.error); toast(r.error, 'error'); return }
    setResult(r?.ok ?? 'Saved')
    toast(r?.ok ?? 'Saved')
    setStep('done')
  })
  const close = () => ref.current?.close()
  const done = () => close()

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(k)) return
    e.preventDefault()
    // Move from the focused option (the first one when nothing is picked yet), like a native radio group.
    const at = (document.activeElement as HTMLElement | null)?.dataset.value ?? pick
    const i = Math.max(0, choices.findIndex(c => c.value === at))
    const n = choices[(i + (k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length]
    setPick(n.value)
  }
  useEffect(() => {
    // Keep keyboard focus on the picked option after arrow keys.
    if (pick && ref.current?.contains(document.activeElement) && document.activeElement?.getAttribute('role') === 'radio')
      ref.current.querySelector<HTMLElement>(`[data-value="${pick}"]`)?.focus()
  }, [pick])

  const earlier = history.filter(h => h.to).slice(-5).reverse()
  const tone = cur?.group === 'out' ? 'border-red-500/30 bg-red-500/10' : cur?.group === 'offer' || cur?.group === 'decision' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-line bg-subtle'

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {cur ? (
          <span data-testid="drive-status-chip" className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${tone}`}>
            <span aria-hidden>{cur.emoji}</span><span className="font-medium">{cur.summary}</span>
            {updatedAt && <span className="text-xs text-muted">· updated {ago(days)}</span>}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">Not answered yet</span>
        )}
        {!nudge && <button type="button" data-testid="drive-status-open" onClick={open} className={`${cur ? 'btn-outline' : 'btn-primary'} min-h-11`}>{cur ? 'Update my status' : 'Set my status'}</button>}
      </div>
      {nudge && (
        <div data-testid="drive-nudge" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <span>Heard anything from <b>{company}</b>? You’ve been waiting {days} days.</span>
          <button type="button" data-testid="drive-status-open" onClick={open} className="btn-primary min-h-11">Update my status</button>
        </div>
      )}

      <dialog ref={ref} aria-labelledby={`ds-t-${job}`} aria-busy={pending}
        className="card m-auto w-[calc(100%-1rem)] max-w-lg p-0 text-fg backdrop:bg-black/40 backdrop:backdrop-blur-[1px] sm:w-[calc(100%-2rem)]"
        onClick={e => e.target === ref.current && !pending && close()}
        onCancel={e => pending && e.preventDefault()}
        onClose={() => { if (step === 'done') router.refresh() }}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5">
          <div>
            <h2 id={`ds-t-${job}`} className="font-semibold">{step === 'choose' ? `Where are you with ${company}?` : step === 'review' ? (isOffer ? 'Please double-check — this is important' : 'Please check before saving') : 'Saved'}</h2>
            {step === 'choose' && <p className="text-sm text-muted">{role}</p>}
          </div>
          <button type="button" className="btn-ghost min-h-11 min-w-11 px-2" aria-label="Close" onClick={close}><X className="size-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">
          {step === 'choose' && (
            <div className="space-y-4">
              <div role="radiogroup" aria-label={`Your status with ${company}`} onKeyDown={onKey} className="space-y-4">
                {DRIVE_GROUPS.map(g => {
                  const items = choices.filter(c => c.group === g.id)
                  if (!items.length) return null
                  return (
                    <div key={g.id}>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{g.title}</p>
                      <div className="space-y-2">
                        {items.map(c => {
                          const on = pick === c.value
                          const tab = on || (!pick && c.value === choices[0].value)
                          return (
                            <button key={c.value} type="button" role="radio" aria-checked={on} tabIndex={tab ? 0 : -1} data-testid="drive-choice" data-value={c.value}
                              onClick={() => setPick(c.value)}
                              className={`flex min-h-11 w-full items-start gap-3 rounded-xl border p-3 text-left transition ${on ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line hover:bg-subtle'}`}>
                              <span className="text-xl leading-none" aria-hidden>{c.emoji}</span>
                              <span className="min-w-0"><span className="block font-semibold">{c.title}</span><span className="block text-xs text-muted">{c.help}</span></span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <label className="block text-sm">
                <span className="font-medium">Anything to add? (optional)</span>
                <input name="remarks" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. test on Friday" className="mt-1 min-h-11 w-full rounded-lg border border-line bg-transparent px-3 py-2" />
              </label>
              {earlier.length > 0 && (
                <details className="rounded-lg border border-line px-3 py-2 text-sm">
                  <summary className="min-h-8 cursor-pointer font-medium">Your earlier updates</summary>
                  <ul className="mt-2 space-y-1.5">
                    {earlier.map((h, i) => <li key={i} className="text-xs"><span className="text-muted">{dm(h.at)}</span> · {driveChoice(h.to)?.summary ?? h.to}{h.remarks ? <span className="text-muted"> — “{h.remarks}”</span> : null}</li>)}
                  </ul>
                </details>
              )}
              {same && <p className="text-xs text-muted">That’s already your status.</p>}
              <div className="flex justify-end">
                <button type="button" data-testid="drive-review" className="btn-primary min-h-11" disabled={!pick || same} onClick={() => { setError(''); setConfirm(false); setStep('review') }}>Review</button>
              </div>
            </div>
          )}

          {step === 'review' && chosen && (
            <div className="space-y-4">
              {isOffer ? (
                <div className="space-y-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4">
                  <p className="text-lg font-semibold"><span aria-hidden>🎉</span> You’re telling us you got an offer</p>
                  <p className="text-sm">Saving this tells the placement team you have a job offer from <b>{company}</b>. They will contact you to verify it.</p>
                  <label className="flex min-h-11 items-start gap-2.5 text-sm font-medium">
                    <input type="checkbox" data-testid="offer-confirm" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
                    <span>Yes, I have received an offer from {company}</span>
                  </label>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-subtle/50 p-4 text-sm">
                  <p className="font-semibold">{company} <span className="font-normal text-muted">· {role}</span></p>
                  <p className="mt-2 text-xs text-muted">You’re telling us:</p>
                  <p className="font-medium"><span aria-hidden>{chosen.emoji}</span> {chosen.summary}</p>
                  {note.trim() && <p className="mt-2 text-xs text-muted">Note: “{note.trim()}”</p>}
                </div>
              )}
              {isOffer && note.trim() && <p className="text-xs text-muted">Note: “{note.trim()}”</p>}
              {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-700 dark:text-red-300">{error}</p>}
              <div className="flex justify-between gap-2">
                <button type="button" className="btn-outline min-h-11" disabled={pending} onClick={() => setStep('choose')}>Back</button>
                <button type="button" data-testid="drive-save" className="btn-primary min-h-11" disabled={pending || (isOffer && !confirm)} onClick={save}>{pending ? 'Saving…' : isOffer ? 'Yes, save my offer' : 'Save my status'}</button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-500" aria-hidden />
              <p className="text-sm">{result}</p>
              <p className="text-sm text-muted"><b>What happens next:</b> {NEXT[chosen?.group === 'decision' ? chosen.value : (chosen?.group ?? 'none')]}</p>
              <button type="button" data-testid="drive-done" className="btn-primary min-h-11" onClick={done}>Done</button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  )
}
