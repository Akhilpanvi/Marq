import { audit, currentUser, rateLimit } from '@/lib/auth'
import { canReport, REPORTS } from '@/lib/reports'
import { csv, xlsx } from '@/lib/sheet'

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const me = await currentUser()
  const { kind } = await params
  if (!canReport(me, kind, true)) return new Response('Forbidden', { status: 403 })
  if (!(await rateLimit(`export:${me!._id}`, 30, 600))) return new Response('Too many exports. Try again in a few minutes.', { status: 429 })
  const url = new URL(req.url)
  const report = await REPORTS[kind].build(me!, url.searchParams)
  await audit(me, 'reports', 'report.export', kind, undefined, { rows: report.rows.length, format: url.searchParams.get('format') })
  const stamp = new Date().toISOString().slice(0, 10)
  const name = `MARQ-${kind}-${stamp}`
  if (url.searchParams.get('format') === 'csv')
    return new Response(csv(report.columns, report.rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` } })
  const body = await xlsx([{ name: report.title, columns: report.columns, rows: report.rows }, { name: 'About', columns: ['MARQ · Marquee Achievement & Readiness Quotient'], rows: [['Koneru Lakshmaiah Education Foundation (KL University)'], [`${report.title} — generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} by ${me!.name}`]] }])
  return new Response(body, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${name}.xlsx"` } })
}
