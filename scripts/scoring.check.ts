// Run: npx tsx scripts/scoring.check.ts
import assert from 'node:assert/strict'
import { attendancePct, buckets, change, githubPoints, profile, slope, toScore, weighted, DEFAULT_SCORING } from '../lib/scoring'

assert.equal(attendancePct({ present: 6, late: 2, absent: 2, excused: 5 }), 80)
assert.equal(attendancePct({}), null)
assert.deepEqual(weighted({ coding: 80, github: null }, DEFAULT_SCORING.overall), { score: 80, coverage: 40 / 100 })
assert.equal(weighted({}, DEFAULT_SCORING.overall).score, null)
assert.equal(slope([10, 20, 30]), 10)
assert.equal(slope([50, 50]), null)
assert.equal(githubPoints({ contributions: 200, repos: 10, stars: 4 }), 320)
assert.equal(toScore(50000, 20000), 100) // capped
assert.equal(toScore(5000, 20000), 25)

const p = profile(
  [
    { category: 'Coding', date: '2026-09-01', marks: 40, max: 100 },
    { category: 'Coding', date: '2026-09-08', marks: 60, max: 100 },
    { category: 'Aptitude', date: '2026-10-01', marks: 40, max: 50 },
    { category: 'Aptitude', date: '2026-10-02', marks: null, max: 50 },
  ],
  { present: 9, absent: 1 },
  DEFAULT_SCORING,
  { codingPoints: 10000, github: { contributions: 200, repos: 10, stars: 4 } },
)
assert.equal(p.dims.coding, 50) // 10,000 of 20,000
assert.equal(p.dims.github, 80) // 320 of 400
assert.equal(p.dims.assessments, 60) // (40 + 60 + 80) / 3
assert.equal(p.dims.attendance, 90)
assert.equal(p.absences, 1)
assert.deepEqual(p.byCategory, { Coding: 50, Aptitude: 80 })
// overall = (50*40 + 80*25 + 60*20 + 90*15) / 100
assert.ok(Math.abs(p.overall! - (50 * 40 + 80 * 25 + 60 * 20 + 90 * 15) / 100) < 1e-9)
assert.equal(p.flags.improving, true) // 40 → 60 → 80
// nothing linked or recorded → no score at all (never a fabricated zero)
assert.equal(profile([], undefined).overall, null)

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

import { parseRegister } from '../lib/register-parse'
import { columns, clock } from '../lib/periods'
{
  // the college sheet layout (merged headers arrive as the value in the top-left cell)
  const rows = [
    ['Sl No.', 'Student ID NO', 'Parent Branch', 'Branch', 'Student Name', '3', '4', '5', '6', '', '8', '9'],
    ['', '', '', '', '', '9.20 AM to 10.10 AM', '10.10 AM to 11.00 AM', '11.10 AM to 12.00 PM', '12.00 PM to 12.50 PM', '12.50 PM to 1.50 PM', '1.50 PM to 2.40 PM', '2.40 PM to 3.30 PM'],
    ['', '', '', '', '', '02.11.2026'],
    ['1', '2300030012', 'CSE', 'CSE2', 'Addepalli Omkar', 'P', 'P', 'P', 'P', 'Lunch Break', 'P', 'P'],
    ['11', '2300030442', 'CSE', 'HTR', 'Mopuri Guru Shailesh', 'A', 'A', 'A', 'A', 'Lunch Break', 'A', 'a'],
  ]
  const r = parseRegister(rows)
  assert.equal(r.day, '2026-11-02')
  assert.deepEqual(r.periods.map(p => p.no), [3, 4, 5, 6, 8, 9])
  assert.deepEqual(r.periods[4], { no: 8, start: '13:50', end: '14:40' })
  assert.deepEqual(Object.values(r.marks['2300030442']), ['A', 'A', 'A', 'A', 'A', 'A'])
  assert.equal(r.marks['2300030012'][9], 'P')
  assert.equal(r.blanks, 0)
  assert.equal(parseRegister(rows.filter((_, i) => i !== 2), 'Attendance 05-11-2026.xlsx').day, '2026-11-05')
  assert.equal(columns(r.periods).filter(c => c.kind === 'break').length, 1)
  assert.equal(clock('13:50'), '1.50 PM')
  console.log('register parser: ok')
}
