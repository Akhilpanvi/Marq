import Link from 'next/link'
import { FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { requirePage } from '@/lib/auth'
import { canReport, REPORTS } from '@/lib/reports'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const me = await requirePage('reports.view')
  const available = Object.entries(REPORTS).filter(([k]) => canReport(me, k, false))
  return (
    <>
      <PageHeader title="Reports" description="Every report respects your role and student scope. Downloads are recorded in the audit log." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {available.map(([k, r]) => {
          const dl = canReport(me, k, true)
          return (
            <div key={k} className="card flex flex-col p-5">
              <div className="flex items-center gap-2 font-semibold"><FileText className="size-4 text-muted" />{r.title}</div>
              <p className="mt-1 flex-1 text-sm text-muted">{r.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/reports/${k}`} className="btn-outline py-1.5"><Printer className="size-4" />View &amp; print</Link>
                {dl && <a href={`/api/reports/${k}?format=xlsx`} className="btn-outline py-1.5"><FileSpreadsheet className="size-4" />Excel</a>}
                {dl && <a href={`/api/reports/${k}?format=csv`} className="btn-ghost py-1.5">CSV</a>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
