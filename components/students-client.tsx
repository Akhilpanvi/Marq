'use client'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { Download, FileCheck2, Upload } from 'lucide-react'
import { bulkStudents, confirmImport, previewImport, type ImportRow } from '@/app/actions/students'
import type { Opt } from '@/lib/options'
import { toast } from './toast'
import { downloadCsv } from './download'
import { Badge } from './ui'

export function SelectAll() {
  return <input type="checkbox" aria-label="Select all" className="size-4 accent-brand-600" onChange={e => document.querySelectorAll<HTMLInputElement>('input[form=bulk][name=ids]').forEach(el => (el.checked = e.currentTarget.checked))} />
}

export function BulkBar({ batches, mentors, canEdit, canAccounts }: { batches: Opt[]; mentors: Opt[]; canEdit: boolean; canAccounts: boolean }) {
  const [state, run, pending] = useActionState(bulkStudents, null)
  const [, start] = useTransition()
  const links = (state?.data as { links?: string[][] } | undefined)?.links
  useEffect(() => void (state?.ok ? toast(state.ok) : state?.error && toast(state.error, 'error')), [state])
  if (!canEdit && !canAccounts) return null
  return (
    <form id="bulk" className="no-print flex flex-wrap items-center gap-2 border-b border-line bg-subtle/50 p-3 text-sm"
      onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); start(() => run(fd)) }}>
      <span className="text-muted">With selected:</span>
      {canEdit && (
        <>
          <select name="batch" className="input w-auto py-1.5" aria-label="Set batch"><option value="">Batch…</option><option value="none">Remove batch</option>{batches.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select name="mentor" className="input w-auto py-1.5" aria-label="Set mentor"><option value="">Mentor…</option><option value="none">Remove mentor</option>{mentors.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select name="status" className="input w-auto py-1.5" aria-label="Set status"><option value="">Status…</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="withdrawn">Withdrawn</option><option value="completed">Completed</option></select>
          <button name="op" value="update" className="btn-outline py-1.5" disabled={pending}>Apply</button>
        </>
      )}
      {canAccounts && <button name="op" value="accounts" className="btn-outline py-1.5" disabled={pending}>Create accounts &amp; invite</button>}
      {links && <button type="button" className="btn-primary py-1.5" onClick={() => downloadCsv('marq-activation-links.csv', [['Registration No', 'Email', 'One-time activation link'], ...links])}><Download className="size-4" />Activation links ({links.length})</button>}
    </form>
  )
}

type Summary = { total: number; create: number; update: number; failed: number; duplicate: number; skipped: number }
const TONE = { create: 'green', update: 'blue', duplicate: 'amber', error: 'red', skip: 'zinc' } as const

export function ImportWizard({ canUpdate }: { canUpdate: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [update, setUpdate] = useState(false)
  const [pv, preview, p1] = useActionState(previewImport, null)
  const [done, commit, p2] = useActionState(confirmImport, null)
  const [, start] = useTransition()
  const result = (done?.data ?? pv?.data) as { rows: ImportRow[]; summary: Summary; done: boolean } | undefined
  useEffect(() => void (pv?.error && toast(pv.error, 'error')), [pv])
  useEffect(() => void (done?.ok ? toast(done.ok) : done?.error && toast(done.error, 'error')), [done])
  const fd = () => { const f = new FormData(); f.set('file', file!); if (update) f.set('update', 'on'); return f }
  const failed = result?.rows.filter(r => r.errors.length) ?? []

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/students/template" className="btn-outline"><Download className="size-4" />1. Download template</a>
          <a href="/api/students/template?sample=1" className="btn-ghost"><Download className="size-4" />Sample with examples</a>
          <label className="btn-outline cursor-pointer"><Upload className="size-4" />2. {file ? file.name : 'Choose .xlsx / .csv'}
            <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={e => setFile(e.currentTarget.files?.[0] ?? null)} />
          </label>
          {canUpdate && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={update} onChange={e => setUpdate(e.currentTarget.checked)} className="size-4 accent-brand-600" />Update existing students (matched by registration number)</label>}
          <button className="btn-primary" disabled={!file || p1} onClick={() => start(() => preview(fd()))}><FileCheck2 className="size-4" />{p1 ? 'Checking…' : '3. Validate & preview'}</button>
        </div>
        {pv?.error && <p role="alert" className="text-sm text-red-600">{pv.error}</p>}
      </div>

      {result && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line p-4 text-sm">
            <span><b className="tabular-nums">{result.summary.total}</b> total</span>
            <span className="text-emerald-600"><b>{result.summary.create}</b> {result.done ? 'imported' : 'new'}</span>
            <span className="text-indigo-600 dark:text-indigo-300"><b>{result.summary.update}</b> {result.done ? 'updated' : 'to update'}</span>
            <span className="text-red-600"><b>{result.summary.failed}</b> failed</span>
            <span className="text-amber-600"><b>{result.summary.duplicate}</b> duplicates</span>
            <span className="text-muted"><b>{result.summary.skipped}</b> skipped</span>
            <div className="ml-auto flex gap-2">
              {failed.length > 0 && <button className="btn-outline" onClick={() => downloadCsv('marq-import-errors.csv', [['Row', 'Registration No', 'Name', 'Email', 'Outcome', 'Reason'], ...failed.map(r => [String(r.row), r.data.regNo ?? '', r.data.name ?? '', r.data.email ?? '', r.outcome, r.errors.join('; ')])])}><Download className="size-4" />Failed records</button>}
              {!result.done && <button className="btn-primary" disabled={p2 || !(result.summary.create + result.summary.update)} onClick={() => start(() => commit(fd()))}>{p2 ? 'Importing…' : `4. Confirm import (${result.summary.create + result.summary.update})`}</button>}
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-line bg-surface"><tr>{['Row', 'Reg. No', 'Name', 'Email', 'Department', 'Batch', 'Outcome'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {result.rows.map(r => (
                  <tr key={r.row}>
                    <td className="td text-muted tabular-nums">{r.row}</td>
                    <td className="td font-mono text-xs">{r.data.regNo}</td>
                    <td className="td">{r.data.name}</td>
                    <td className="td text-muted">{r.data.email}</td>
                    <td className="td">{r.data.department}</td>
                    <td className="td">{r.data.batch}</td>
                    <td className="td"><Badge tone={TONE[r.outcome]}>{r.outcome}</Badge>{r.errors.length > 0 && <div className="mt-1 text-xs text-muted">{r.errors.join('; ')}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
