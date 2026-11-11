import Link from 'next/link'

// Day-by-day attendance tiles — replaces the monthly bar chart, which says little when attendance is taken daily.
export type Day = { day: string; attended: number; held: number; note?: string; href?: string }

const label = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })

export function AttendanceDays({ days, unit = 'periods', limit = 30 }: { days: Day[]; unit?: string; limit?: number }) {
  if (!days.length) return <p className="text-sm text-muted">No attendance recorded yet.</p>
  const shown = [...days].sort((a, b) => b.day.localeCompare(a.day)).slice(0, limit)
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {shown.map(d => {
          const p = d.held ? d.attended / d.held : 0
          const tone = p >= 1 ? 'border-emerald-500/40 bg-emerald-500/10' : p >= 0.75 ? 'border-amber-500/40 bg-amber-500/10' : 'border-red-500/40 bg-red-500/10'
          const body = (
            <>
              <div className="text-[11px] text-muted">{label(d.day)}</div>
              <div className="text-base font-semibold tabular-nums">{d.attended}/{d.held}</div>
              <div className="text-[11px] text-muted">{d.note ?? unit}</div>
            </>
          )
          return d.href
            ? <Link key={d.day} href={d.href} className={`rounded-lg border p-2 transition hover:shadow-sm ${tone}`}>{body}</Link>
            : <div key={d.day} className={`rounded-lg border p-2 ${tone}`}>{body}</div>
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-emerald-500/60" />All attended</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-amber-500/60" />75% or more</span>
        <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-red-500/60" />Below 75%</span>
        {days.length > limit && <span>Showing the latest {limit} of {days.length} days</span>}
      </p>
    </>
  )
}
