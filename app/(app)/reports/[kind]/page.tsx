import { notFound } from 'next/navigation'
import { requirePage } from '@/lib/auth'
import { canReport, REPORTS } from '@/lib/reports'
import { PageHeader } from '@/components/ui'
import { AutoPrint, PrintButton } from '@/components/print'
import { KlLockup, FULL_NAME } from '@/components/logo'

// Printed pages are built here, not left to the browser: each page holds a fixed number of rows and starts on a new
// sheet, so a row can never be cut in half at a page break (Safari and Chrome both) and every page carries the logo header.
const ROWS_PER_PAGE = 22
const ROWS_PER_PAGE_TALL = 14 // reports with long text cells (evaluations…)

export default async function ReportView({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('reports.view')
  const { kind } = await params
  if (!canReport(me, kind, false)) notFound()
  const sp = await searchParams
  const report = await REPORTS[kind].build(me, new URLSearchParams(sp))
  const tall = report.rows.some(r => r.some(v => String(v ?? '').length > 60))
  const per = tall ? ROWS_PER_PAGE_TALL : ROWS_PER_PAGE
  const pages = Array.from({ length: Math.max(1, Math.ceil(report.rows.length / per)) }, (_, i) => report.rows.slice(i * per, (i + 1) * per))
  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
  return (
    <>
      {sp.print === '1' && <AutoPrint />}
      <div className="no-print"><PageHeader back={{ href: '/reports', label: 'Reports' }} title={report.title} description={`${report.rows.length} rows`}><PrintButton label="Print / Save PDF" /></PageHeader></div>
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <article className="card print-flow p-6">
        {pages.map((rows, pi) => (
          <section key={pi} data-testid="report-page" className={`report-page ${pi > 0 ? 'print:break-before-page' : ''}`}>
            {/* logo header: always on the first page; on later pages only when printing */}
            <header data-testid={pi === 0 ? 'report-header' : undefined} className={`mb-4 items-center justify-between gap-6 border-b-2 border-line pb-3 ${pi === 0 ? 'flex' : 'hidden print:flex'}`}>
              {/* plain images (not inline SVG) so they render identically on every printed page */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/marq-wordmark.svg" alt="MARQ" className="h-8 w-auto shrink-0" />
              <div className="text-center text-[11px] leading-tight text-muted"><div className="font-semibold text-fg">{report.title}</div>{FULL_NAME}</div>
              <KlLockup className="h-11 w-auto shrink-0" />
            </header>
            {pi === 0 && (
              <>
                <h2 className="text-lg font-semibold">{report.title}</h2>
                <p className="mb-3 text-xs text-muted">Generated {generated}</p>
              </>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className={`border-b border-line ${pi === 0 ? '' : 'hidden print:table-header-group'}`}>
                  <tr><th className="th">Sl No.</th>{report.columns.map(c => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 tabular-nums text-muted">{pi * per + i + 1}</td>
                      {r.map((v, j) => <td key={j} className={`px-3 py-1.5 ${String(v ?? '').length <= 60 ? 'print:whitespace-nowrap' : ''}`}>{v ?? '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 hidden justify-between text-[10px] text-muted print:flex"><span>MARQ · Koneru Lakshmaiah Education Foundation (KL University)</span><span>Page {pi + 1} of {pages.length}</span></div>
          </section>
        ))}
      </article>
    </>
  )
}
