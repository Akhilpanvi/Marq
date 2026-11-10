import { Badge, type Tone } from './ui'
import type { TargetFlag } from '@/lib/coding-points'

const FLAG: Record<Exclude<TargetFlag, null>, [string, Tone]> = { met: ['Target met', 'green'], behind: ['Work harder', 'amber'], far: ['Improve immediately', 'red'] }

export function FlagBadge({ flag }: { flag: TargetFlag }) {
  return flag ? <Badge tone={FLAG[flag][1]}>{FLAG[flag][0]}</Badge> : null
}

/** Scope chips as plain links (GET), MARQ styling. */
export function Chips({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-print flex flex-wrap gap-2 border-b border-line p-3">
      {items.map(i => (
        <a key={i.key} href={i.href} aria-current={i.key === active ? 'page' : undefined}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${i.key === active ? 'border-transparent bg-accent text-white' : 'border-line text-muted hover:text-fg'}`}>
          {i.label}
        </a>
      ))}
    </div>
  )
}
