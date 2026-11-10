// Pure, shared (client + server). Shown verbatim on the leaderboard so every number is explainable.

export const PLATFORMS = {
  leetcode: { label: 'LeetCode', url: (h: string) => `https://leetcode.com/u/${h}`, base: 1300, perSolved: 10 },
  codechef: { label: 'CodeChef', url: (h: string) => `https://www.codechef.com/users/${h}`, base: 1200, perSolved: 2 },
  codeforces: { label: 'Codeforces', url: (h: string) => `https://codeforces.com/profile/${h}`, base: 800, perSolved: 0 },
} as const
export type PlatformKey = keyof typeof PLATFORMS
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as PlatformKey[]
export const PER_CONTEST = 50

/** points = solved × k + max(0, rating − base)² ÷ 10 + contests × 50 */
export function platformPoints(p: PlatformKey, s: { solved?: number | null; rating?: number | null; contests?: number | null }) {
  const { base, perSolved } = PLATFORMS[p]
  const above = Math.max(0, (s.rating ?? 0) - base)
  return Math.round((s.solved ?? 0) * perSolved + (above * above) / 10 + (s.contests ?? 0) * PER_CONTEST)
}

export const formulaText = (p: PlatformKey) => {
  const { base, perSolved } = PLATFORMS[p]
  return `${perSolved ? `solved × ${perSolved} + ` : ''}(rating − ${base})² ÷ 10 + contests × ${PER_CONTEST}`
}

export type TargetFlag = 'met' | 'behind' | 'far' | null

/** Against a points target: met; behind (≥ 50%) = work harder; far (< 50%) = improve immediately. */
export function targetFlag(points: number, target?: number | null): TargetFlag {
  if (!target) return null
  if (points >= target) return 'met'
  return points >= target / 2 ? 'behind' : 'far'
}
