// Run: npx tsx scripts/scoring.check.ts
import assert from 'node:assert/strict'
import { attendancePct, buckets, change, profile, slope, weighted, DEFAULT_SCORING } from '../lib/scoring'

assert.equal(attendancePct({ present: 6, late: 2, absent: 2, excused: 5 }), 80)
assert.equal(attendancePct({}), null)
assert.deepEqual(weighted({ coding: 80, technical: null }, { ...DEFAULT_SCORING.overall }), { score: 80, coverage: 25 / 100 })
assert.equal(weighted({}, DEFAULT_SCORING.overall).score, null)
assert.equal(slope([10, 20, 30]), 10)
assert.equal(slope([50, 50]), null)

const p = profile(
  [
    { category: 'Coding', date: '2026-09-01', marks: 40, max: 100 },
    { category: 'Coding', date: '2026-09-08', marks: 60, max: 100 },
    { category: 'Aptitude', date: '2026-10-01', marks: 40, max: 50 },
    { category: 'Aptitude', date: '2026-10-02', marks: null, max: 50 },
  ],
  { present: 9, absent: 1 },
)
assert.equal(p.dims.coding, 50)
assert.equal(p.dims.aptitude, 80)
assert.equal(p.dims.attendance, 90)
assert.equal(p.absences, 1)
// overall = (50*25 + 80*15 + 90*15) / 55
assert.ok(Math.abs(p.overall! - (50 * 25 + 80 * 15 + 90 * 15) / 55) < 1e-9)
assert.equal(p.flags.improving, true) // 40 → 60 → 80

const b = buckets([{ category: 'Coding', date: '2026-09-30T20:00:00Z', marks: 50, max: 100 }, { category: 'Coding', date: '2026-10-05', marks: 70, max: 100 }])
assert.deepEqual(b.map(x => x.key), ['2026-10']) // 30 Sep 20:00 UTC is 1 Oct IST
assert.equal(change(buckets([{ category: 'x', date: '2026-09-02', marks: 50, max: 100 }, { category: 'x', date: '2026-10-02', marks: 70, max: 100 }])), 20)
console.log('scoring: ok')

import { platformPoints, targetFlag } from '../lib/coding-points'
assert.equal(platformPoints('leetcode', { solved: 100, rating: 1500, contests: 2 }), 100 * 10 + 4000 + 100)
assert.equal(platformPoints('codeforces', { rating: 700, contests: 0 }), 0) // below base adds nothing
assert.equal(platformPoints('codechef', {}), 0)
assert.equal(targetFlag(1000, 1000), 'met')
assert.equal(targetFlag(600, 1000), 'behind')
assert.equal(targetFlag(400, 1000), 'far')
assert.equal(targetFlag(400, null), null)
console.log('coding points: ok')
