'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail } from 'lucide-react'
import { sendPlacementInvites } from '@/app/actions/students'
import { toast } from './toast'

type R = { sent: number; created: number; failed: string[]; remaining: number; noMail: number }

/** Sends registration links to placement mail IDs in short batches until done, with live progress. */
export function PlacementInvites({ todo, recent, noMail }: { todo: number; recent: number; noMail: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [progress, setProgress] = useState<string | null>(null)

  const run = () => {
    if (!confirm(`Email the registration link to the placement mail ID of ${todo} student${todo === 1 ? '' : 's'} who haven’t registered yet? Students sent a link in the last 6 hours are skipped.`)) return
    start(async () => {
      let sent = 0, created = 0, failed: string[] = []
      for (let round = 0; round < 40; round++) {
        const r = await sendPlacementInvites(null, new FormData())
        if (r?.error) { toast(r.error, 'error'); break }
        const d = r?.data as R
        sent += d.sent; created += d.created; failed = [...failed, ...d.failed]
        setProgress(`Sent ${sent} of ${todo}…`)
        if (d.remaining === 0 || (d.sent === 0 && d.failed.length === 0)) break
      }
      setProgress(null)
      toast(`Sent ${sent} registration link${sent === 1 ? '' : 's'} to placement mail IDs${created ? ` (${created} new account${created === 1 ? '' : 's'})` : ''}.${failed.length ? ` ${failed.length} could not be sent: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}.` : ''}`, failed.length ? 'error' : 'ok')
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {todo > 0 ? (
        <button type="button" className="btn-primary py-1.5 text-xs" disabled={pending} onClick={run}>
          <Mail className="size-3.5" />{pending ? progress ?? 'Sending…' : `Email registration links to placement mail IDs (${todo})`}
        </button>
      ) : (
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">✓ Registration links sent to everyone not registered</span>
      )}
      {recent > 0 && <span className="text-xs text-muted">{recent} sent in the last 6 hours</span>}
      {noMail > 0 && <span className="text-xs text-red-600">{noMail} without a placement mail ID</span>}
    </span>
  )
}
