import 'server-only'
import ExcelJS from 'exceljs'
import { parseCsv, parseCsvRows } from './csv'
import { Invalid } from './form'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 5000

/** First sheet of an .xlsx/.csv upload as raw text rows (no header assumptions). Validates type and size. */
export async function readRawRows(file: FormDataEntryValue | null): Promise<string[][]> {
  if (!(file instanceof File) || !file.size) throw new Invalid('Choose an Excel (.xlsx) or CSV file.')
  if (file.size > MAX_BYTES) throw new Invalid('File is larger than 2 MB.')
  const name = file.name.toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())
  if (name.endsWith('.csv')) return parseCsvRows(buf.toString('utf8').replace(/^\uFEFF/, ''))
  if (!name.endsWith('.xlsx') || buf.subarray(0, 2).toString() !== 'PK') throw new Invalid('Upload the register as .xlsx (Excel) or .csv.')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Invalid('The workbook has no sheets.')
  const rows: string[][] = []
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const r: string[] = []
    row.eachCell({ includeEmpty: true }, (c, i) => (r[i - 1] = cellText(c.value).trim()))
    rows[n - 1] = Array.from(r, v => v ?? '')
  })
  if (rows.length > MAX_ROWS) throw new Invalid(`At most ${MAX_ROWS} rows per upload.`)
  return Array.from(rows, r => r ?? [])
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, '0')}.${String(v.getUTCMonth() + 1).padStart(2, '0')}.${v.getUTCFullYear()}`
  if (typeof v === 'object') {
    if ('text' in v && v.text != null) return String(v.text)
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue)
    if ('richText' in v) return v.richText.map(t => t.text).join('')
    if ('hyperlink' in v) return String(v.hyperlink)
  }
  return String(v)
}

/** Reads the first sheet of an .xlsx or a .csv upload into header→value rows. Validates type and size. */
export async function readSheet(file: FormDataEntryValue | null): Promise<Record<string, string>[]> {
  if (!(file instanceof File) || !file.size) throw new Invalid('Choose an Excel (.xlsx) or CSV file.')
  if (file.size > MAX_BYTES) throw new Invalid('File is larger than 2 MB.')
  const name = file.name.toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())
  let rows: Record<string, string>[]
  if (name.endsWith('.csv')) rows = parseCsv(buf.toString('utf8').replace(/^﻿/, ''))
  else if (name.endsWith('.xlsx')) {
    if (buf.subarray(0, 2).toString() !== 'PK') throw new Invalid('That file is not a valid .xlsx workbook.')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.worksheets[0]
    if (!ws) throw new Invalid('The workbook has no sheets.')
    const text = (v: ExcelJS.CellValue): string => {
      if (v == null) return ''
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      if (typeof v === 'object') {
        if ('text' in v && v.text != null) return String(v.text)
        if ('result' in v) return text(v.result as ExcelJS.CellValue)
        if ('richText' in v) return v.richText.map(t => t.text).join('')
        if ('hyperlink' in v) return String(v.hyperlink)
      }
      return String(v)
    }
    const head: string[] = []
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (head[i] = text(c.value).trim()))
    rows = []
    ws.eachRow((row, n) => {
      if (n === 1) return
      const r: Record<string, string> = {}
      head.forEach((h, i) => h && (r[h] = text(row.getCell(i).value).trim()))
      if (Object.values(r).some(Boolean)) rows.push(r)
    })
  } else throw new Invalid('Only .xlsx and .csv files are supported.')
  if (rows.length > MAX_ROWS) throw new Invalid(`At most ${MAX_ROWS} rows per upload.`)
  return rows
}

/** Maps loosely-named headers ("Reg No", "registration number") onto canonical keys. */
export function normalise(rows: Record<string, string>[], aliases: Record<string, string[]>) {
  const canon = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
  const lookup = new Map<string, string>()
  for (const [key, names] of Object.entries(aliases)) for (const n of [key, ...names]) lookup.set(canon(n), key)
  return rows.map(r => {
    const out: Record<string, string> = {}
    for (const [h, v] of Object.entries(r)) {
      const k = lookup.get(canon(h))
      if (k) out[k] = v.trim()
    }
    return out
  })
}

/** Neutralise spreadsheet formula injection in exported cells. */
export const safeCell = (v: unknown) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

export async function xlsx(sheets: { name: string; columns: string[]; rows: unknown[][] }[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MARQ · KL University'
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31))
    ws.addRow(s.columns).font = { bold: true }
    s.rows.forEach(r => ws.addRow(r.map(v => (typeof v === 'number' ? v : safeCell(v)))))
    ws.columns.forEach(c => (c.width = 18))
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export const csv = (columns: string[], rows: unknown[][]) =>
  '﻿' + [columns, ...rows].map(r => r.map(v => `"${(typeof v === 'number' ? String(v) : safeCell(v)).replace(/"/g, '""')}"`).join(',')).join('\r\n')
