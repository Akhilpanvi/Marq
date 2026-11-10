import { DIMENSIONS, type ScoringConfig } from '@/lib/scoring'

/** Shows exactly how every score is computed from the live configuration. */
export function Formula({ cfg }: { cfg: ScoringConfig }) {
  const dims = Object.entries(DIMENSIONS) as [keyof typeof DIMENSIONS, string][]
  const byDim = (d: string) => Object.entries(cfg.categoryDim).filter(([, v]) => v === d).map(([k]) => k)
  const total = (w: Record<string, number>) => Object.values(w).reduce((s, x) => s + x, 0)
  return (
    <div className="space-y-5 text-sm">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Each result becomes a percentage: <code className="rounded bg-subtle px-1">marks ÷ maximum × 100</code>. Absent results are left out of averages (attendance already reflects absence).</li>
        <li>Each dimension is the plain average of its percentages. A dimension with no results shows “—” and is <b>not</b> counted as zero.</li>
        <li>Attendance = (present + late) ÷ (present + late + absent) × 100. Excused sessions are left out.</li>
        <li>Overall and Readiness are weighted averages over the dimensions that have data; weights re-normalise across what is available. “Coverage” shows how much of the total weight had data.</li>
        <li>Trend is the least-squares slope of the last 6 results (points per assessment). Improving ≥ +{cfg.thresholds.trend}, declining ≤ −{cfg.thresholds.trend}.</li>
        <li>High performer: overall ≥ {cfg.thresholds.high}. Needs attention: overall &lt; {cfg.thresholds.attention} or attendance &lt; {cfg.thresholds.attendance}%.</li>
      </ol>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-subtle/60"><tr><th className="th">Dimension</th><th className="th">Assessment categories</th><th className="th text-right">Overall weight</th><th className="th text-right">Readiness weight</th></tr></thead>
          <tbody className="divide-y divide-line">
            {dims.map(([k, label]) => (
              <tr key={k}>
                <td className="td font-medium">{label}</td>
                <td className="td text-muted">{k === 'attendance' ? 'Training attendance' : byDim(k).join(', ') || '—'}</td>
                <td className="td text-right tabular-nums">{cfg.overall[k]} <span className="text-muted">({Math.round((cfg.overall[k] / total(cfg.overall)) * 100)}%)</span></td>
                <td className="td text-right tabular-nums">{cfg.readiness[k]} <span className="text-muted">({Math.round((cfg.readiness[k] / total(cfg.readiness)) * 100)}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
