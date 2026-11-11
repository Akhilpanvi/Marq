import { DIMENSIONS, type ScoringConfig } from '@/lib/scoring'
import { formulaText, PLATFORMS, PLATFORM_KEYS } from '@/lib/coding-points'

const fmt = (n: number) => n.toLocaleString('en-IN')

/** Shows exactly how every score is computed from the live configuration. */
export function Formula({ cfg }: { cfg: ScoringConfig }) {
  const dims = Object.entries(DIMENSIONS) as [keyof typeof DIMENSIONS, string][]
  const total = (w: Record<string, number>) => Object.values(w).reduce((s, x) => s + x, 0)
  const source: Record<keyof typeof DIMENSIONS, string> = {
    coding: `Coding points ÷ ${fmt(cfg.targets.codingPoints)} × 100 (capped at 100)`,
    github: `GitHub points ÷ ${fmt(cfg.targets.githubPoints)} × 100 (capped at 100)`,
    assessments: 'Average % across all assessments (marks ÷ maximum × 100)',
    attendance: '(present + late) ÷ (present + late + absent) × 100',
  }
  return (
    <div className="space-y-5 text-sm">
      <p>Scores use objective data only — coding profiles, GitHub, assessment marks and attendance. Nothing depends on trainer or mentor judgement. A part with no data yet shows “—” and is left out (never counted as zero); the weights re-normalise across what is available, and “coverage” shows how much of the weight had data.</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-subtle/60"><tr><th className="th">Part</th><th className="th">Score out of 100</th><th className="th text-right">Overall weight</th><th className="th text-right">Readiness weight</th></tr></thead>
          <tbody className="divide-y divide-line">
            {dims.map(([k, label]) => (
              <tr key={k}>
                <td className="td font-medium">{label}</td>
                <td className="td text-muted">{source[k]}</td>
                <td className="td text-right tabular-nums">{cfg.overall[k]} <span className="text-muted">({Math.round((cfg.overall[k] / (total(cfg.overall) || 1)) * 100)}%)</span></td>
                <td className="td text-right tabular-nums">{cfg.readiness[k]} <span className="text-muted">({Math.round((cfg.readiness[k] / (total(cfg.readiness) || 1)) * 100)}%)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li><b className="text-fg">Coding points</b> = sum over platforms: {PLATFORM_KEYS.map(p => `${PLATFORMS[p].label}: ${formulaText(p)}`).join(' · ')}.</li>
        <li><b className="text-fg">GitHub points</b> = contributions in the last year + public repositories × 10 + stars × 5.</li>
        <li>Trend = slope of the last six assessment results (points per assessment): improving ≥ +{cfg.thresholds.trend}, declining ≤ −{cfg.thresholds.trend}.</li>
        <li>High performer: overall ≥ {cfg.thresholds.high}. Needs attention: overall &lt; {cfg.thresholds.attention} or attendance &lt; {cfg.thresholds.attendance}%.</li>
      </ul>
    </div>
  )
}
