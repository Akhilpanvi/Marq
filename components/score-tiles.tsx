import Link from 'next/link'
import { DIMENSIONS } from '@/lib/scoring'
import type { Profile } from '@/lib/scoring'
import { Meter, Score } from './ui'

export function ScoreTiles({ p, explain = '/performance#formula' }: { p: Profile; explain?: string }) {
  const tiles: [string, number | null, string?][] = [
    ['Overall performance', p.overall, p.coverage < 0.5 && p.overall != null ? `Based on ${Math.round(p.coverage * 100)}% of weighted inputs` : undefined],
    ['Placement readiness', p.readiness],
    ...(Object.entries(DIMENSIONS) as [keyof typeof DIMENSIONS, string][]).map(([k, l]) => [k === 'attendance' ? 'Attendance' : `${l}`, p.dims[k]] as [string, number | null]),
    ['Assessment average', p.assessmentAvg, `${p.assessments} assessed${p.absences ? `, ${p.absences} absent` : ''}`],
  ]
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, v, hint], i) => (
          <div key={label} className={`card p-3.5 ${i < 2 ? 'ring-1 ring-brand-500/10' : ''}`}>
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1.5 flex items-baseline gap-1 text-2xl"><Score value={v} />{v != null && <span className="text-xs text-muted">/100</span>}</div>
            <div className="mt-2"><Meter value={v} label={label} /></div>
            {hint && <div className="mt-1.5 text-[11px] text-muted">{hint}</div>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Scores average only real results; missing categories are left out, not counted as zero. <Link href={explain} className="text-accent hover:underline">How these are calculated</Link>
      </p>
    </div>
  )
}
