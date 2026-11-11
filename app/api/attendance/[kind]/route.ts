import { audit, can, currentUser, rateLimit, scopedStudentIds } from '@/lib/auth'
import { consolidatedWorkbook, dayRows, dayWorkbook, loadRegisters, summaryRows } from '@/lib/register'
import { csv } from '@/lib/sheet'
import { Batch, DailyRegister } from '@/models'
import type { Period } from '@/lib/periods'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// /api/attendance/day?day=YYYY-MM-DD&batch=<id>&format=xlsx|csv
// /api/attendance/consolidated?from=&to=&batch=<id, optional>&format=xlsx|csv
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await currentUser()
  const { kind } = await params
  if (!me || me.student || !can(me, 'attendance.view')) return new Response('Forbidden', { status: 403 })
  if (!(await rateLimit(`export:${me._id}`, 30, 600))) return new Response('Too many exports. Try again in a few minutes.', { status: 429 })
  const q = new URL(req.url).searchParams
  const format = q.get('format') === 'csv' ? 'csv' : 'xlsx'
  const scope = await scopedStudentIds(me)
  const bId = /^[a-f0-9]{24}$/i.test(q.get('batch') ?? '') ? q.get('batch')! : null
  const batch = bId ? await Batch.findById(bId).select('name').lean() : null
  const tag = batch ? `-${batch.name.replace(/[^\w-]+/g, '_')}` : ''

  if (kind === 'day') {
    const day = q.get('day') ?? ''
    const reg = DAY.test(day) && batch ? await DailyRegister.findOne({ day, batch: batch._id }).lean() : null
    if (!reg) return new Response('No register for that batch and day', { status: 404 })
    const data = await loadRegisters(day, day, scope, batch!._id)
    const name = `MARQ-attendance${tag}-${day}`
    await audit(me, 'attendance', 'register.export', `${day} · ${batch!.name}`, undefined, { format })
    if (format === 'csv') {
      const { head, body } = dayRows(day, reg.periods as Period[], data)
      return new Response(csv(head[0], [...head.slice(1), ...body]), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` } })
    }
    return new Response(await dayWorkbook(day, reg.periods as Period[], data), { headers: { 'content-type': XLSX, 'content-disposition': `attachment; filename="${name}.xlsx"` } })
  }

  if (kind === 'consolidated') {
    const from = DAY.test(q.get('from') ?? '') ? q.get('from')! : undefined
    const to = DAY.test(q.get('to') ?? '') ? q.get('to')! : undefined
    const data = await loadRegisters(from, to, scope, batch?._id)
    const name = `MARQ-attendance-consolidated${tag}${from ? `-${from}` : ''}${to ? `-to-${to}` : ''}`
    await audit(me, 'attendance', 'register.exportConsolidated', `${from ?? 'start'}..${to ?? 'today'}`, undefined, { format, days: data.regs.length })
    if (format === 'csv') {
      const { head, body } = summaryRows(data)
      return new Response(csv(head, body), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` } })
    }
    return new Response(await consolidatedWorkbook(data), { headers: { 'content-type': XLSX, 'content-disposition': `attachment; filename="${name}.xlsx"` } })
  }
  return new Response('Not found', { status: 404 })
}
