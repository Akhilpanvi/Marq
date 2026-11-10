import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth'
import { canReport, REPORTS } from '@/lib/reports'
import { PageHeader } from '@/components/ui'
import { PrintButton } from '@/components/print'
import { KlLockup, MarqWordmark, FULL_NAME } from '@/components/logo'

export default async function ReportView({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('reports.view')
  const { kind } = await params
  if (!canReport(me, kind, false)) notFound()
  const report = await REPORTS[kind].build(me, new URLSearchParams(await searchParams))
  return (
    <>
      <div className="no-print"><PageHeader back={{ href: '/reports', label: 'Reports' }} title={report.title} description={`${report.rows.length} rows`}><PrintButton label="Print / Save PDF" /></PageHeader></div>
      <article className="card p-6 print:border-0 print:p-0">
        <header className="mb-6 flex items-center justify-between gap-6 border-b border-line pb-4">
          <div><MarqWordmark className="h-7 w-auto" /><div className="mt-1 text-xs text-muted">{FULL_NAME}</div></div>
          <KlLockup className="h-10 w-auto" />
        </header>
        <h2 className="text-lg font-semibold">{report.title}</h2>
        <p className="mb-4 text-xs text-muted">Generated {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} · {me.name} ({me.roleName})</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-line"><tr>{report.columns.map(c => <th key={c} className="th">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{report.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="px-3 py-1.5">{v ?? '—'}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <footer className="mt-6 border-t border-line pt-3 text-[10px] text-muted">MARQ · Koneru Lakshmaiah Education Foundation (KL University) · Confidential — for authorised use only</footer>
      </article>
    </>
  )
}
