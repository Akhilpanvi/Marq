// Shared (client + server): the college timetable used by the daily register.
export type Period = { no: number; start: string; end: string } // 24h HH:MM, IST

export const DEFAULT_PERIODS: Period[] = [
  { no: 3, start: '09:20', end: '10:10' },
  { no: 4, start: '10:10', end: '11:00' },
  { no: 5, start: '11:10', end: '12:00' },
  { no: 6, start: '12:00', end: '12:50' },
  { no: 8, start: '13:50', end: '14:40' },
  { no: 9, start: '14:40', end: '15:30' },
]

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

/** "13:50" → "1.50 PM", matching the college sheet. */
export function clock(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}.${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export const span = (p: { start: string; end: string }) => `${clock(p.start)} to ${clock(p.end)}`

/** Columns to draw: periods, plus a Lunch Break column wherever the gap between periods is 40+ minutes. */
export function columns(periods: Period[]): ({ kind: 'period'; p: Period } | { kind: 'break'; start: string; end: string })[] {
  const out: ReturnType<typeof columns> = []
  const sorted = [...periods].sort((a, b) => mins(a.start) - mins(b.start))
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev && mins(p.start) - mins(prev.end) >= 40) out.push({ kind: 'break', start: prev.end, end: p.start })
    out.push({ kind: 'period', p })
  })
  return out
}

/** "9.20 AM" / "1:50 pm" / "13.50" → "HH:MM", or null. */
export function to24(s: string) {
  const m = s.trim().match(/^(\d{1,2})[.:](\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = Number(m[1])
  const ap = m[3]?.toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return h < 24 && Number(m[2]) < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : null
}
