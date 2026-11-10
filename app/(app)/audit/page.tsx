import { requirePage } from '@/lib/auth'
import { MODULES } from '@/lib/rbac'
import { dayTime } from '@/lib/format'
import { AuditLog } from '@/models'
import { Card, PageHeader, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'

export const metadata = { title: 'Audit Logs' }

const short = (v: unknown) => { if (v == null) return ''; const s = JSON.stringify(v); return s.length > 160 ? s.slice(0, 160) + '…' : s }

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePage('audit.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), module = sp(params, 'module'), from = sp(params, 'from'), to = sp(params, 'to')
  const filter: Record<string, unknown> = {}
  if (q) filter.$or = [{ action: new RegExp(escapeRe(q), 'i') }, { actorName: new RegExp(escapeRe(q), 'i') }, { target: new RegExp(escapeRe(q), 'i') }]
  if (module) filter.module = module
  if (from || to) filter.at = { ...(from ? { $gte: new Date(`${from}T00:00:00+05:30`) } : {}), ...(to ? { $lte: new Date(`${to}T23:59:59+05:30`) } : {}) }
  const [logs, total] = await Promise.all([AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(), AuditLog.countDocuments(filter)])
  return (
    <>
      <PageHeader title="Audit Logs" description="Append-only record of administrative actions. Entries cannot be edited or deleted from the application." />
      <Card pad={false}>
        <Filters params={params} placeholder="Search action, user or target">
          <Select name="module" value={module} options={Object.entries(MODULES)} all="All modules" />
          <label className="flex items-center gap-1 text-sm text-muted">From <input type="date" name="from" defaultValue={from} className="input w-auto" /></label>
          <label className="flex items-center gap-1 text-sm text-muted">To <input type="date" name="to" defaultValue={to} className="input w-auto" /></label>
        </Filters>
        <Table head={['When', 'User', 'Module', 'Action', 'Target', 'Previous', 'Updated', 'IP']}>
          {logs.map(l => (
            <tr key={String(l._id)} className="align-top">
              <td className="td text-xs whitespace-nowrap text-muted">{dayTime(l.at)}</td>
              <td className="td">{l.actorName}</td>
              <td className="td text-muted">{l.module}</td>
              <td className="td font-mono text-xs">{l.action}</td>
              <td className="td font-mono text-xs text-muted">{l.target}</td>
              <td className="td max-w-56 font-mono text-[11px] break-all text-muted">{short(l.before)}</td>
              <td className="td max-w-56 font-mono text-[11px] break-all text-muted">{short(l.after)}</td>
              <td className="td font-mono text-xs text-muted">{l.ip}</td>
            </tr>
          ))}
        </Table>
        <Pager page={page} total={total} params={params} path="/audit" />
      </Card>
    </>
  )
}
