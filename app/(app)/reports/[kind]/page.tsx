import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth'
import { canReport, REPORTS } from '@/lib/reports'
import { PageHeader } from '@/components/ui'
import { AutoPrint, PrintButton } from '@/components/print'
import { KlLockup, FULL_NAME } from '@/components/logo'

export default async function ReportView({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('reports.view')
  const { kind } = await params
  if (!canReport(me, kind, false)) notFound()
  const sp = await searchParams
  const report = await REPORTS[kind].build(me, new URLSearchParams(sp))
  return (
    <>
      {sp.print === '1' && <AutoPrint />}
      <div className="no-print"><PageHeader back={{ href: '/reports', label: 'Reports' }} title={report.title} description={`${report.rows.length} rows`}><PrintButton label="Print / Save PDF" /></PageHeader></div>
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
      <article className="card print-flow p-6">
        {/* thead / tfoot repeat on every printed page, so each PDF page has the logo header */}
        <table className="w-full border-collapse">
          <thead className="table-header-group" data-testid="report-header">
            <tr><td className="p-0">
              <header className="mb-5 flex items-center justify-between gap-6 border-b-2 border-line pb-4">
                {/* a plain image (not inline SVG) so it also repeats correctly on every printed page */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/marq-wordmark.svg" alt="MARQ" className="h-8 w-auto shrink-0" />
                <div className="text-center text-[11px] leading-tight text-muted"><div className="font-semibold text-fg">{report.title}</div>{FULL_NAME}</div>
                <KlLockup className="h-11 w-auto shrink-0" />
              </header>
            </td></tr>
          </thead>
          <tfoot className="table-footer-group">
            <tr><td className="p-0"><footer className="mt-4 border-t border-line pt-3 text-[10px] text-muted">MARQ · Koneru Lakshmaiah Education Foundation (KL University) · Confidential — for authorised use only</footer></td></tr>
          </tfoot>
          <tbody>
            <tr><td className="p-0 align-top">
              <h2 className="text-lg font-semibold">{report.title}</h2>
              <p className="mb-4 text-xs text-muted">Generated {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} · {me.name} ({me.roleName}) · {report.rows.length} rows</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-line"><tr>{report.columns.map(c => <th key={c} className="th">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">{report.rows.map((r, i) => <tr key={i} className="break-inside-avoid">{r.map((v, j) => <td key={j} className={`px-3 py-1.5 ${String(v ?? '').length <= 38 ? 'print:whitespace-nowrap' : ''}`}>{v ?? '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </td></tr>
          </tbody>
        </table>
      </article>
    </>
  )
}
