'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

type T = { id: number; text: string; kind: 'ok' | 'error' }
const listeners = new Set<(t: T) => void>()
let n = 0
export const toast = (text: string, kind: T['kind'] = 'ok') => listeners.forEach(l => l({ id: ++n, text, kind }))

export function Toaster() {
  const [items, set] = useState<T[]>([])
  useEffect(() => {
    const l = (t: T) => {
      set(x => [...x, t])
      setTimeout(() => set(x => x.filter(i => i.id !== t.id)), 4500)
    }
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className="card pointer-events-auto flex items-start gap-2.5 p-3 text-sm shadow-lg">
          {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}
