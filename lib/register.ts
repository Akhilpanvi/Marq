import 'server-only'
import ExcelJS from 'exceljs'
import type { Types } from 'mongoose'
import { Attendance, DailyRegister, Student, TrainingSession } from '@/models'
import { columns, span, type Period } from './periods'
import { safeCell } from './sheet'

const dmy = (day: string) => day.split('-').reverse().join('.')
export const STUDENT_COLS = ['Sl No.', 'Student ID NO', 'Parent Branch', 'Branch', 'Student Name', 'Placement Mail ID']

/** Old installs had one register per day (unique "day"); registers are now per batch per day. Idempotent. */
let indexesFixed = false
export async function fixRegisterIndexes() {
  if (indexesFixed) return
  await DailyRegister.collection.dropIndex('day_1').catch(() => {})
  await DailyRegister.collection.createIndex({ day: 1, batch: 1 }, { unique: true }).catch(() => {})
  indexesFixed = true
}

/** Marks of every register in [from, to] (inclusive, YYYY-MM-DD), for one batch or all, limited to `scope` students when given. */
export async function loadRegisters(from?: string, to?: string, scope?: Types.ObjectId[] | null, batch?: Types.ObjectId | string | null) {
  const regs = await DailyRegister.find({ ...(from || to ? { day: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}), ...(batch ? { batch } : {}) }).sort({ day: 1 }).lean()
  const sessions = await TrainingSession.find({ register: { $in: regs.map(r => r._id) } }).select('register start').lean()
  const marks = await Attendance.find({ session: { $in: sessions.map(s => s._id) }, ...(scope ? { student: { $in: scope } } : {}) }).select('session student status history').lean()
  const sessionOf = new Map(sessions.map(s => [String(s._id), s]))
  // students with marks, plus dropped students of these registers' batches (their row shows D from the drop day on)
  const batches = [...new Set(regs.flatMap(r => (r.batch ? [String(r.batch)] : [])))]
  const who: Record<string, unknown> = { $or: [
    { _id: { $in: [...new Set(marks.map(m => String(m.student)))] } },
    ...(batches.length ? [{ status: 'dropped', batch: { $in: batches }, ...(to ? { 'dropped.day': { $lte: to } } : {}), ...(scope ? { _id: { $in: scope } } : {}) }] : []),
  ] }
  const students = await Student.find(who).select('regNo name department specialization personalEmail status dropped').sort({ regNo: 1 }).lean()
  const droppedFrom = new Map(students.filter(s => s.status === 'dropped' && s.dropped?.day).map(s => [String(s._id), s.dropped!.day!]))
  // status[studentId][day][periodNo]
  const status = new Map<string, Map<string, Map<number, string>>>()
  const corrected = new Set<string>()
  for (const m of marks) {
    const s = sessionOf.get(String(m.session))!
    const reg = regs.find(r => String(r._id) === String(s.register))!
    const p = reg.periods.find(x => x.start === s.start)
    if (!p?.no) continue
    const byDay = status.get(String(m.student)) ?? status.set(String(m.student), new Map()).get(String(m.student))!
    const byP = byDay.get(reg.day) ?? byDay.set(reg.day, new Map()).get(reg.day)!
    byP.set(p.no, m.status)
    if (m.history.length) corrected.add(`${m.student}|${reg.day}|${p.no}`)
  }
  // several batches on one day → one column group per day (a student is in one batch, so marks never collide)
  const byDay = new Map<string, { day: string; periods: Period[] }>()
  for (const r of regs) {
    const d = byDay.get(r.day) ?? byDay.set(r.day, { day: r.day, periods: [] }).get(r.day)!
    for (const p of r.periods as Period[]) if (!d.periods.some(x => x.no === p.no)) d.periods.push(p)
    d.periods.sort((a, b) => a.no - b.no)
  }
  return { regs: [...byDay.values()], students, status, corrected, droppedFrom }
}

const mark = (st?: string) => (st === 'absent' ? 'A' : st === 'excused' ? 'E' : st ? 'P' : '')
type Data = Awaited<ReturnType<typeof loadRegisters>>
/** P / A / E, or D (dropped) from the student's drop day on. */
const markOf = (data: Data, sid: string, day: string, no: number) => {
  const d = data.droppedFrom.get(sid)
  return d && day >= d ? 'D' : mark(data.status.get(sid)?.get(day)?.get(no))
}

/** The college sheet: 3 header rows (period no., time, date), P/A cells, Lunch Break column. */
export function dayRows(day: string, periods: Period[], data: Awaited<ReturnType<typeof loadRegisters>>) {
  const cols = columns(periods)
  const head = [
    [...STUDENT_COLS, ...cols.map(c => (c.kind === 'period' ? String(c.p.no) : ''))],
    [...STUDENT_COLS.map(() => ''), ...cols.map(c => (c.kind === 'period' ? span(c.p) : span(c)))],
    [...STUDENT_COLS.map(() => ''), dmy(day), ...cols.slice(1).map(() => '')],
  ]
  const body = data.students.map((s, i) => [String(i + 1), s.regNo, s.department ?? '', s.specialization ?? '', s.name, s.personalEmail ?? '', ...cols.map(c => (c.kind === 'break' ? 'Lunch Break' : markOf(data, String(s._id), day, c.p.no)))])
  return { head, body, cols }
}

const thin = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } }
const border = { top: thin, left: thin, bottom: thin, right: thin }
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } })
const ABSENT = 'FFF4B6B6', EXCUSED = 'FFE7E6E6', HEAD = 'FFF8CBAD', PERIOD = 'FFC6E0B4'

function styleHeader(ws: ExcelJS.Worksheet, rows: number, studentCols: number) {
  for (let r = 1; r <= rows; r++)
    ws.getRow(r).eachCell({ includeEmpty: true }, (c, i) => {
      c.font = { bold: true }
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      c.fill = fill(i <= studentCols ? HEAD : PERIOD)
      c.border = border
    })
  for (let i = 1; i <= studentCols; i++) ws.mergeCells(1, i, rows, i)
}

export async function dayWorkbook(day: string, periods: Period[], data: Awaited<ReturnType<typeof loadRegisters>>) {
  const { head, body, cols } = dayRows(day, periods, data)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MARQ · KL University'
  const ws = wb.addWorksheet(`Attendance ${dmy(day)}`)
  head.forEach(r => ws.addRow(r))
  body.forEach(r => ws.addRow(r.map(safeCell)))
  styleHeader(ws, 3, STUDENT_COLS.length)
  ws.mergeCells(3, STUDENT_COLS.length + 1, 3, STUDENT_COLS.length + cols.length)
  for (let r = 4; r <= ws.rowCount; r++)
    ws.getRow(r).eachCell({ includeEmpty: true }, (c, i) => {
      c.border = border
      if (i > STUDENT_COLS.length) c.alignment = { horizontal: 'center' }
      if (c.value === 'A') c.fill = fill(ABSENT)
      else if (c.value === 'E' || c.value === 'D') c.fill = fill(EXCUSED)
    })
  ws.columns = [{ width: 7 }, { width: 15 }, { width: 10 }, { width: 9 }, { width: 34 }, { width: 30 }, ...cols.map(() => ({ width: 14 }))]
  ws.views = [{ state: 'frozen', xSplit: STUDENT_COLS.length, ySplit: 3 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Per student: attended/held per day, then totals and the percentage last. */
export function summaryRows(data: Awaited<ReturnType<typeof loadRegisters>>) {
  const head = [...STUDENT_COLS, ...data.regs.map(r => `${dmy(r.day)} (of ${r.periods.length})`), 'Total Held', 'Total Attended', 'Total Absent', 'Attendance %']
  const body = data.students.map((s, i) => {
    let held = 0, attended = 0
    const days = data.regs.map(r => {
      const d = data.droppedFrom.get(String(s._id))
      if (d && r.day >= d) return 'D'
      const byP = data.status.get(String(s._id))?.get(r.day)
      if (!byP) return '—'
      const vals = [...byP.values()].filter(v => v !== 'excused') // excused periods are not counted
      const n = vals.filter(v => v !== 'absent').length
      held += vals.length
      attended += n
      return `${n}/${vals.length}`
    })
    return [String(i + 1), s.regNo, s.department ?? '', s.specialization ?? '', s.name, s.personalEmail ?? '', ...days, held, attended, held - attended, held ? Math.round((attended / held) * 10000) / 100 : null] as (string | number | null)[]
  })
  return { head, body }
}

export async function consolidatedWorkbook(data: Awaited<ReturnType<typeof loadRegisters>>) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MARQ · KL University'

  const { head, body } = summaryRows(data)
  const sum = wb.addWorksheet('Summary')
  sum.addRow(head)
  body.forEach(r => sum.addRow(r.map(v => (typeof v === 'number' || v == null ? v : safeCell(v)))))
  sum.getRow(1).eachCell(c => ((c.font = { bold: true }), (c.fill = fill(HEAD)), (c.border = border), (c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true })))
  const pctCol = head.length
  for (let r = 2; r <= sum.rowCount; r++) {
    sum.getRow(r).eachCell({ includeEmpty: true }, c => (c.border = border))
    const pc = sum.getRow(r).getCell(pctCol)
    pc.numFmt = '0.00"%"'
    pc.font = { bold: true }
    if (typeof pc.value === 'number' && pc.value < 75) pc.fill = fill(ABSENT)
  }
  sum.columns = [{ width: 7 }, { width: 15 }, { width: 10 }, { width: 9 }, { width: 34 }, { width: 30 }, ...data.regs.map(() => ({ width: 13 })), { width: 11 }, { width: 14 }, { width: 12 }, { width: 13 }]
  sum.views = [{ state: 'frozen', xSplit: STUDENT_COLS.length, ySplit: 1 }]

  // Day-wise: the college sheet for every day side by side (period no. / time / date, Lunch Break), consolidation last
  const det = wb.addWorksheet('Day-wise', { properties: { tabColor: { argb: 'FFA41C24' } } })
  const blocks = data.regs.map(r => ({ day: r.day, cols: columns(r.periods) }))
  const rNo = [...STUDENT_COLS], rTime = [...STUDENT_COLS.map(() => '')], rDate = [...STUDENT_COLS.map(() => '')]
  const spans: [number, number][] = []
  for (const b of blocks) {
    spans.push([rNo.length + 1, rNo.length + b.cols.length])
    b.cols.forEach((c, i) => {
      rNo.push(c.kind === 'period' ? String(c.p.no) : '')
      rTime.push(c.kind === 'period' ? span(c.p) : span(c))
      rDate.push(i ? '' : dmy(b.day))
    })
  }
  const TOTALS = ['Total Held', 'Total Attended', 'Total Absent', 'Excused', 'Attendance %']
  rNo.push(...TOTALS); rTime.push(...TOTALS.map(() => '')); rDate.push(...TOTALS.map(() => ''))
  det.addRow(rNo); det.addRow(rTime); det.addRow(rDate)
  styleHeader(det, 3, STUDENT_COLS.length)
  const n = rNo.length
  for (const [a, b] of spans) if (b > a) det.mergeCells(3, a, 3, b) // date across each day's block
  for (let i = n - TOTALS.length + 1; i <= n; i++) det.mergeCells(1, i, 3, i)
  for (let r = 1; r <= 3; r++) for (let i = n - TOTALS.length + 1; i <= n; i++) det.getRow(r).getCell(i).fill = fill(HEAD)
  data.students.forEach((s, i) => {
    const marks = blocks.flatMap(b => b.cols.map(c => (c.kind === 'break' ? 'Lunch Break' : markOf(data, String(s._id), b.day, c.p.no))))
    const held = marks.filter(c => c === 'P' || c === 'A').length, att = marks.filter(c => c === 'P').length
    const row = det.addRow([String(i + 1), s.regNo, s.department ?? '', s.specialization ?? '', s.name, s.personalEmail ?? '', ...marks, held, att, held - att, marks.filter(c => c === 'E').length, held ? Math.round((att / held) * 10000) / 100 : null].map(v => (typeof v === 'string' ? safeCell(v) : v)))
    row.eachCell({ includeEmpty: true }, (c, j) => {
      c.border = border
      if (j > STUDENT_COLS.length) c.alignment = { horizontal: 'center' }
      if (c.value === 'A') c.fill = fill(ABSENT)
      else if (c.value === 'E' || c.value === 'D') c.fill = fill(EXCUSED)
      else if (c.value === 'Lunch Break') c.font = { size: 9, color: { argb: 'FF71717A' } }
    })
    const pc = row.getCell(n)
    pc.numFmt = '0.00"%"'
    pc.font = { bold: true }
    if (typeof pc.value === 'number' && pc.value < 75) pc.fill = fill(ABSENT)
  })
  det.columns = [{ width: 7 }, { width: 15 }, { width: 10 }, { width: 9 }, { width: 34 }, { width: 30 }, ...blocks.flatMap(b => b.cols.map(c => ({ width: c.kind === 'break' ? 12 : 11 }))), ...TOTALS.map(() => ({ width: 12 }))]
  det.views = [{ state: 'frozen', xSplit: STUDENT_COLS.length, ySplit: 3 }]
  ;(det as unknown as { orderNo: number }).orderNo = 0 // day-wise opens first, summary second

  return Buffer.from(await wb.xlsx.writeBuffer())
}
