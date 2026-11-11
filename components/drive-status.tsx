'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { setDriveStatus } from '@/app/actions/placement'
import { toast } from './toast'

// Two plain questions instead of one long list: (1) did you apply? (2) how far did you get, and are you still in?
// Each answer maps to exactly one option of the programme's Google Form question (lib/placement DRIVE_OPTIONS).
const STAGES = [
  { key: 'applied', label: 'Applied', in: 'Applied - No Response', out: null },
  { key: 'test', label: 'Online test', in: 'Written Test Completed', out: 'Written Test Rejected' },
  { key: 'tr', label: 'Technical round', in: 'Technical Interview Scheduled', out: 'Technical Round Rejected' },
  { key: 'hr', label: 'HR round', in: 'HR Interview Completed', out: 'HR Rejected' },
  { key: 'offer', label: 'Offer', in: 'Offered', out: null },
] as const
type Stage = (typeof STAGES)[number]

const IN_TEXT: Record<Stage['key'], string> = {
  applied: 'Applied — waiting to hear back',
  test: 'Wrote the online test — waiting for the result',
  tr: 'Cleared the online test — in the technical round',
  hr: 'Cleared the HR round — waiting for the offer',
  offer: 'Selected — offer received 🎉',
}

function read(status?: string) {
  if (!status) return { applied: null as boolean | null, stage: null as Stage | null, out: false }
  if (status === 'Not Applied') return { applied: false, stage: null, out: false }
  if (status === 'Accepted' || status === 'Declined') return { applied: true, stage: STAGES[4], out: false }
  const s = STAGES.find(x => x.in === status || x.out === status) ?? STAGES[0] // "Applied" from the Apply button → stage 1
  return { applied: true, stage: s, out: s.out === status }
}

export function DriveStatus({ job, status, formLabel }: { job: string; status?: string; formLabel?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const cur = read(status)
  const [applied, setApplied] = useState<boolean | null>(cur.applied)

  const save = (value: string) => start(async () => {
    const fd = new FormData()
    fd.set('job', job)
    fd.set('status', value)
    const r = await setDriveStatus(null, fd)
    if (r?.error) return void toast(r.error, 'error')
    toast(r?.ok ?? 'Saved')
    router.refresh()
  })

  const choice = (on: boolean, text: string, onClick: () => void, tone: 'brand' | 'red' = 'brand') => (
    <button type="button" disabled={pending} aria-pressed={on} onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-60 ${on ? (tone === 'red' ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300' : 'border-accent bg-accent-soft font-medium text-accent') : 'border-line hover:bg-subtle'}`}>
      {on && <Check className="size-3.5" />}{text}
    </button>
  )

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-line bg-subtle/40 p-3" aria-busy={pending}>
      <div>
        <p className="text-sm font-medium">1. Did you apply for this drive? {cur.applied === null && <span className="text-xs font-normal text-red-600">· please answer</span>}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {choice(applied === true, 'Yes, I applied', () => { setApplied(true); if (!cur.applied) save('Applied - No Response') })}
          {choice(applied === false, 'No, I didn’t apply', () => { setApplied(false); if (cur.applied !== false) save('Not Applied') })}
        </div>
      </div>

      {applied && cur.applied && (
        <div>
          <p className="text-sm font-medium">2. How far have you reached?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAGES.map(s => choice(cur.stage?.key === s.key, s.label, () => save(cur.out && s.out ? s.out : s.in)))}
          </div>
          {cur.stage?.out && (
            <div className="mt-3">
              <p className="text-sm font-medium">3. Are you still in the process at this stage?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {choice(!cur.out, 'Yes, still in', () => save(cur.stage!.in))}
                {choice(cur.out, 'No, not selected', () => save(cur.stage!.out!), 'red')}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Your status: <b className={cur.out ? 'text-red-600' : 'text-fg'}>{cur.out ? `Not selected in the ${cur.stage!.label.toLowerCase()}` : IN_TEXT[cur.stage!.key]}</b>
            {formLabel && <span> · recorded as “{formLabel}”</span>}
          </p>
        </div>
      )}
      {cur.applied === false && <p className="text-xs text-muted">Recorded as “Not applied”. Changed your mind? Choose “Yes, I applied”.</p>}
    </div>
  )
}
