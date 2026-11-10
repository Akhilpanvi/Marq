// Pure scoring maths: no DB, no IO. Shared by server pages and the formula explainer.

export const CATEGORIES = [
  'Technical', 'Programming', 'Data Structures & Algorithms', 'Aptitude', 'Logical Reasoning',
  'Verbal Ability', 'Communication Skills', 'Coding', 'Domain-Specific', 'Mock Interview',
] as const

export const DIMENSIONS = { technical: 'Technical', coding: 'Coding', aptitude: 'Aptitude', communication: 'Communication', interview: 'Interview', attendance: 'Attendance' } as const
export type Dim = keyof typeof DIMENSIONS

export type ScoringConfig = {
  categoryDim: Record<string, Exclude<Dim, 'attendance'>>
  overall: Record<Dim, number>
  readiness: Record<Dim, number>
  thresholds: { high: number; attention: number; attendance: number; trend: number }
}

export const DEFAULT_SCORING: ScoringConfig = {
  categoryDim: {
    Technical: 'technical', 'Domain-Specific': 'technical',
    Programming: 'coding', 'Data Structures & Algorithms': 'coding', Coding: 'coding',
    Aptitude: 'aptitude', 'Logical Reasoning': 'aptitude', 'Verbal Ability': 'aptitude',
    'Communication Skills': 'communication', 'Mock Interview': 'interview',
  },
  overall: { technical: 20, coding: 25, aptitude: 15, communication: 15, interview: 10, attendance: 15 },
  readiness: { technical: 20, coding: 30, aptitude: 10, communication: 15, interview: 20, attendance: 5 },
  thresholds: { high: 75, attention: 50, attendance: 75, trend: 2 },
}

export type ResultPoint = { category: string; date: Date | string; marks: number | null; max: number }
export type AttendanceCounts = { present: number; absent: number; late: number; excused: number }

/** Attendance % = (present + late) / (sessions − excused). Late counts as attended. */
export function attendancePct(a?: Partial<AttendanceCounts>) {
  const p = a?.present ?? 0, l = a?.late ?? 0, ab = a?.absent ?? 0
  const counted = p + l + ab
  return counted ? ((p + l) / counted) * 100 : null
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

/** Weighted mean over dimensions that have data; weights re-normalise so missing data never counts as zero. */
export function weighted(dims: Partial<Record<Dim, number | null>>, weights: Record<Dim, number>) {
  let sum = 0, w = 0
  for (const [k, wt] of Object.entries(weights) as [Dim, number][]) {
    const v = dims[k]
    if (v == null || !wt) continue
    sum += v * wt
    w += wt
  }
  const total = Object.values(weights).reduce((s, x) => s + x, 0)
  return { score: w ? sum / w : null, coverage: total ? w / total : 0 }
}

/** Least-squares slope of the last `n` percentages, in points per assessment. */
export function slope(ys: number[], n = 6) {
  const y = ys.slice(-n)
  if (y.length < 3) return null
  const xm = (y.length - 1) / 2, ym = y.reduce((s, v) => s + v, 0) / y.length
  let num = 0, den = 0
  y.forEach((v, i) => ((num += (i - xm) * (v - ym)), (den += (i - xm) ** 2)))
  return num / den
}

export type Profile = ReturnType<typeof profile>

export function profile(results: ResultPoint[], att: Partial<AttendanceCounts> | undefined, cfg: ScoringConfig = DEFAULT_SCORING) {
  // ponytail: absent (marks null) is excluded from averages; attendance already penalises missed sessions
  const taken = results.filter(r => r.marks != null && r.max > 0).sort((a, b) => +new Date(a.date) - +new Date(b.date))
  const pctOf = (r: ResultPoint) => (r.marks! / r.max) * 100
  const byDim: Partial<Record<Dim, number[]>> = {}
  for (const r of taken) {
    const d = cfg.categoryDim[r.category]
    if (d) (byDim[d] ??= []).push(pctOf(r))
  }
  const dims: Record<Dim, number | null> = {
    technical: mean(byDim.technical ?? []), coding: mean(byDim.coding ?? []), aptitude: mean(byDim.aptitude ?? []),
    communication: mean(byDim.communication ?? []), interview: mean(byDim.interview ?? []), attendance: attendancePct(att),
  }
  const series = taken.map(pctOf)
  const overall = weighted(dims, cfg.overall)
  const readiness = weighted(dims, cfg.readiness)
  const trend = slope(series)
  const t = cfg.thresholds
  const flags = {
    high: overall.score != null && overall.score >= t.high,
    improving: trend != null && trend >= t.trend,
    declining: trend != null && trend <= -t.trend,
    attention: (overall.score != null && overall.score < t.attention) || (dims.attendance != null && dims.attendance < t.attendance),
  }
  return { dims, overall: overall.score, coverage: overall.coverage, readiness: readiness.score, assessmentAvg: mean(series), assessments: taken.length, absences: results.length - taken.length, trend, flags }
}

const istDay = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

/** Average % per IST month ("2026-11") or week (Monday's date), oldest first. */
export function buckets(results: ResultPoint[], by: 'month' | 'week' = 'month') {
  const m = new Map<string, number[]>()
  for (const r of results) {
    if (r.marks == null) continue
    let k = istDay(r.date)
    if (by === 'month') k = k.slice(0, 7)
    else {
      const d = new Date(`${k}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      k = d.toISOString().slice(0, 10)
    }
    ;(m.get(k) ?? m.set(k, []).get(k)!).push((r.marks / r.max) * 100)
  }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([key, xs]) => ({ key, avg: mean(xs)! }))
}

/** Change between the last two buckets, in percentage points. */
export const change = (b: { avg: number }[]) => (b.length >= 2 ? b.at(-1)!.avg - b.at(-2)!.avg : null)
