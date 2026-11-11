'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, X } from 'lucide-react'
import { deleteStudent } from '@/app/actions/students'
import { toast } from './toast'

/** Permanent delete, confirmed by typing the student's ID. */
export function DeleteStudent({ id, name, regNo }: { id: string; name: string; regNo: string }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const [pending, start] = useTransition()
  const go = () => start(async () => {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('confirm', typed)
    const r = await deleteStudent(null, fd)
    if (r?.error) return void toast(r.error, 'error')
    dialog.current?.close()
    toast(r?.ok ?? 'Deleted')
    router.replace('/students')
    router.refresh()
  })
  return (
    <>
      <button type="button" className="btn-ghost text-red-600" onClick={() => { setTyped(''); dialog.current?.showModal() }}><Trash2 className="size-4" />Delete student</button>
      <dialog ref={dialog} className="card m-auto w-[calc(100%-2rem)] max-w-md p-0 text-fg" onClick={e => e.target === dialog.current && dialog.current.close()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold text-red-600">Delete {name}?</h2>
          <button type="button" className="btn-ghost px-2" aria-label="Close" onClick={() => dialog.current?.close()}><X className="size-4" /></button>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <p>This permanently removes the student profile and everything linked to it: their login, attendance marks, assessment results, coding profiles, applications and mentor evaluations. It cannot be undone.</p>
          <p className="text-muted">To keep their records but take them out of the cohort, set Cohort status to <b>Withdrawn</b> instead.</p>
          <label className="block"><span className="label">Type <b className="font-mono">{regNo}</b> to confirm</span>
            <input value={typed} onChange={e => setTyped(e.target.value)} className="input mt-1 font-mono" autoComplete="off" aria-label="Type the student ID to confirm" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className="btn-primary bg-red-600 hover:bg-red-700" disabled={pending || typed.trim().toUpperCase() !== regNo} onClick={go}>{pending ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </dialog>
    </>
  )
}
