import { notFound } from 'next/navigation'
import { Trash2, Upload } from 'lucide-react'
import { can, requirePage, scopedStudentIds } from '@/lib/auth'
import { batchOptions, trainerOptions } from '@/lib/options'
import { visibleBatches } from '@/lib/scope'
import { day, fmt } from '@/lib/format'
import { OID } from '@/lib/form'
import { Assessment, AssessmentResult, Batch, Student, User } from '@/models'
import { Badge, Card, Grid, KV, PageHeader, Score, Stat, Table, Empty } from '@/components/ui'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { AssessmentFields } from '@/components/assessment-fields'
import { Bars } from '@/components/charts'
import { PrintButton } from '@/components/print'
import { deleteAssessment, importMarks, saveAssessment, saveMarks } from '@/app/actions/assessments'

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage('assessments.view')
  const { id } = await params
  if (!OID.test(id)) notFound()
  const a = await Assessment.findById(id).lean()
  if (!a) notFound()
  const scope = await visibleBatches(me)
  if (scope && a.batches.length && !a.batches.some(b => scope.some(s => String(s) === String(b))) && String(a.trainer) !== String(me._id)) notFound()

  const scopedIds = await scopedStudentIds(me)
  const rosterFilter: Record<string, unknown> = a.batches.length ? { batch: { $in: a.batches } } : { status: 'active' }
  if (scopedIds) rosterFilter._id = { $in: scopedIds }
  const [students, results, batches, trainer, bOpts, tOpts] = await Promise.all([
    Student.find(rosterFilter).select('name regNo batch').sort({ regNo: 1 }).lean(),
    AssessmentResult.find({ assessment: a._id }).lean(),
    Batch.find({ _id: { $in: a.batches } }).select('name').lean(),
    a.trainer ? User.findById(a.trainer).select('name').lean() : null,
    batchOptions(), trainerOptions(),
  ])
  const res = new Map(results.map(r => [String(r.student), r]))
  const scored = students.map(s => ({ s, r: res.get(String(s._id)) })).filter(x => x.r?.marks != null).map(x => ({ ...x, p: (x.r!.marks! / a.maxMarks) * 100 })).sort((x, y) => y.p - x.p)
  const avg = scored.length ? scored.reduce((t, x) => t + x.p, 0) / scored.length : null
  const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}–${i * 10 + 10}`, students: 0 }))
  scored.forEach(x => bins[Math.min(9, Math.floor(x.p / 10))].students++)
  const bName = new Map(batches.map(b => [String(b._id), b.name]))
  const batchCmp = batches.map(b => {
    const xs = scored.filter(x => String(x.s.batch) === String(b._id))
    return { batch: b.name, avg: xs.length ? Math.round((xs.reduce((t, x) => t + x.p, 0) / xs.length) * 10) / 10 : 0 }
  })
  const trains = me.scope === 'all' || String(a.trainer) === String(me._id) || (await Batch.exists({ _id: { $in: a.batches }, trainers: me._id }))
  const canMarks = can(me, 'assessments.edit') && !!trains
  let rank = 0, prev = -1

  return (
    <>
      <PageHeader back={{ href: '/assessments', label: 'Assessments' }} title={a.name} description={`${a.category} · ${day(a.date)} · out of ${a.maxMarks}`}>
        <PrintButton />
        {canMarks && (
          <Modal label={<><Upload className="size-4" />Import results</>} title="Import results from Excel/CSV" className="btn-outline">
            <ActionForm action={importMarks} submit="Import">
              <input type="hidden" name="id" value={id} />
              <p className="text-sm text-muted">Columns: <b>Registration Number</b>, <b>Marks</b> (number or AB for absent), optional <b>Remarks</b>. Every row is checked first; if any row is invalid nothing is imported.</p>
              <input type="file" name="file" accept=".xlsx,.csv" required className="input" />
            </ActionForm>
          </Modal>
        )}
        {canMarks && (
          <Modal label="Edit" title="Edit assessment" className="btn-outline" wide>
            <ActionForm action={saveAssessment} submit="Save" reset={false}><AssessmentFields a={a} batches={bOpts} trainers={tOpts} /></ActionForm>
          </Modal>
        )}
        {can(me, 'assessments.delete') && !results.length && <ActionButton action={deleteAssessment} fields={{ id }} className="btn-ghost text-red-600" confirm="Delete this assessment?"><Trash2 className="size-4" /></ActionButton>}
      </PageHeader>

      <Grid>
        <Stat label="Average" value={<Score value={avg} />} />
        <Stat label="Highest" value={scored.length ? `${fmt(scored[0].r!.marks, 1)} / ${a.maxMarks}` : '—'} />
        <Stat label="Lowest" value={scored.length ? `${fmt(scored.at(-1)!.r!.marks, 1)} / ${a.maxMarks}` : '—'} />
        <Stat label="Attempted" value={`${scored.length} / ${students.length}`} hint={`${results.filter(r => r.marks == null).length} absent`} />
      </Grid>

      <div className="my-6 grid gap-6 lg:grid-cols-3">
        <Card title="Score distribution" className="lg:col-span-2"><Bars data={bins} x="range" series={[{ key: 'students', label: 'Students' }]} height={220} /></Card>
        <Card title="Details"><KV items={[['Trainer', trainer?.name], ['Duration', a.durationMin ? `${a.durationMin} min` : undefined], ['Batches', batches.map(b => b.name).join(', ') || 'All active students'], ['Status', a.status], ['Remarks', a.remarks]]} /></Card>
      </div>
      {batchCmp.length > 1 && <Card title="Batch comparison" className="mb-6"><Bars data={batchCmp} x="batch" series={[{ key: 'avg', label: 'Average %' }]} domain={[0, 100]} height={200} /></Card>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Rankings" pad={false}>
          <Table head={['#', 'Student', 'Batch', 'Marks', '%']} empty={<Empty>No results yet.</Empty>}>
            {scored.map(x => {
              if (x.p !== prev) { rank++; prev = x.p }
              return <tr key={String(x.s._id)}><td className="td tabular-nums text-muted">{rank}</td><td className="td font-medium">{x.s.name}</td><td className="td text-muted">{bName.get(String(x.s.batch)) ?? '—'}</td><td className="td tabular-nums">{x.r!.marks}</td><td className="td"><Score value={x.p} /></td></tr>
            })}
          </Table>
        </Card>
        <Card title={canMarks ? 'Enter marks' : 'Results'} pad={false}>
          {students.length ? (
            <ActionForm action={saveMarks} reset={false} className="space-y-0">
              <input type="hidden" name="id" value={id} />
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-line bg-surface"><tr><th className="th">Student</th><th className="th">Marks (AB = absent)</th><th className="th">Remarks</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {students.map(s => {
                      const r = res.get(String(s._id))
                      return (
                        <tr key={String(s._id)}>
                          <td className="td"><div className="font-medium">{s.name}</div><div className="font-mono text-xs text-muted">{s.regNo}</div></td>
                          <td className="td"><input name={`m_${s._id}`} defaultValue={r ? (r.marks == null ? 'AB' : String(r.marks)) : ''} disabled={!canMarks} inputMode="decimal" className="input w-24" aria-label={`Marks for ${s.name}`} />{r && r.history.length > 0 && <Badge>edited {r.history.length}×</Badge>}</td>
                          <td className="td"><input name={`r_${s._id}`} defaultValue={r?.remarks ?? ''} disabled={!canMarks} className="input" aria-label={`Remarks for ${s.name}`} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {canMarks && <div className="border-t border-line p-3"><button className="btn-primary">Save marks</button></div>}
            </ActionForm>
          ) : <div className="p-5"><Empty>No students in this assessment&apos;s batches.</Empty></div>}
        </Card>
      </div>
    </>
  )
}
