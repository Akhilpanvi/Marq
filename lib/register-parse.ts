// Pure parser for the college attendance sheet (any .xlsx/.csv laid out like it):
//   header: Sl No | Student ID NO | Parent Branch | Branch | Student Name | 3 | 4 | … | (Lunch) | 8 | 9
//   below the period numbers: "9.20 AM to 10.10 AM" …; a date cell "02.11.2026"; then one row per student with P / A.
import { DEFAULT_PERIODS, to24, type Period } from './periods'

export type Parsed = { day: string | null; periods: Period[]; marks: Record<string, Record<number, 'P' | 'A'>>; blanks: number; warnings: string[] }

const DATE = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/
const TIME = /(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)\s*(?:to|-|–)\s*(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)/i
const ID = /^[A-Za-z0-9-]{6,20}$/

function isoDay(s: string) {
  const m = s.match(DATE)
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const i = s.match(ISO)
  return i ? `${i[1]}-${i[2]}-${i[3]}` : null
}

export function parseRegister(rows: string[][], fileName = ''): Parsed {
  const warnings: string[] = []
  const h = rows.findIndex(r => r.some(c => /student\s*id/i.test(c)))
  if (h < 0) throw new Error('Could not find the "Student ID" column header.')
  const idCol = rows[h].findIndex(c => /student\s*id/i.test(c))
  const nameCol = rows[h].findIndex(c => /name/i.test(c))
  const firstData = rows.findIndex((r, i) => i > h && ID.test(r[idCol] ?? '') && /\d/.test(r[idCol] ?? ''))
  if (firstData < 0) throw new Error('No student rows found under the header.')
  const head = rows.slice(h, firstData)

  // the date: any header cell, else the file name (e.g. "Attendance 02.11.2026.xlsx")
  let day: string | null = null
  for (const r of rows.slice(0, firstData)) for (const c of r) day ??= isoDay(c)
  day ??= isoDay(fileName)
  if (!day) warnings.push('No date found in the sheet; pick it manually.')

  // period columns: right of the name column, with a period number and/or a time range above the data
  const width = Math.max(...rows.map(r => r.length))
  const cols: { col: number; p: Period }[] = []
  for (let c = Math.max(idCol, nameCol) + 1; c < width; c++) {
    const cells = head.map(r => r[c] ?? '')
    if (cells.some(x => /lunch|break/i.test(x)) || rows[firstData][c]?.match(/lunch|break/i)) continue
    const no = Number(cells.find(x => /^\d{1,2}$/.test(x)))
    const t = cells.map(x => x.match(TIME)).find(Boolean)
    const start = t ? to24(t[1]) : null, end = t ? to24(t[2]) : null
    if (!no && !start) continue
    const known = DEFAULT_PERIODS.find(p => p.no === no)
    cols.push({ col: c, p: { no: no || cols.length + 1, start: start ?? known?.start ?? '', end: end ?? known?.end ?? '' } })
  }
  if (!cols.length) throw new Error('No period columns found (expected period numbers like 3, 4, 5 or times like "9.20 AM to 10.10 AM").')
  for (const { p } of cols) if (!p.start || !p.end) warnings.push(`Period ${p.no} has no time; edit it before confirming.`)

  const marks: Parsed['marks'] = {}
  let blanks = 0
  for (const r of rows.slice(firstData)) {
    const id = (r[idCol] ?? '').toUpperCase()
    if (!ID.test(id) || !/\d/.test(id)) continue
    marks[id] = {}
    for (const { col, p } of cols) {
      const v = (r[col] ?? '').trim().toUpperCase()
      if (v === 'A' || v === 'AB' || v === 'ABSENT' || v === '0') marks[id][p.no] = 'A'
      else if (v === 'P' || v === 'PRESENT' || v === '1') marks[id][p.no] = 'P'
      else blanks++ // left as present; reported so the assistant can check
    }
  }
  return { day, periods: cols.map(c => c.p), marks, blanks, warnings }
}
