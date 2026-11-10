import Link from 'next/link'
import { Download } from 'lucide-react'
import { can, requirePage, studentScope } from '@/lib/auth'
import { profiles } from '@/lib/intel'
import { getScoring } from '@/lib/settings'
import { DIMENSIONS, type Dim } from '@/lib/scoring'
import { batchOptions } from '@/lib/options'
import { Batch, Student } from '@/models'
import { Badge, Card, Grid, PageHeader, Score, Stat, Table } from '@/components/ui'
import { Filters, Select, sp } from '@/components/list'
import { Bars } from '@/components/charts'
import { Formula } from '@/components/formula'

export const metadata = { title: 'Performance Intelligence' }

const FLAG = { high: ['High performers', 'green'], improving: ['Improving', 'blue'], declining: ['Declining', 'red'], attention: ['Needs attention', 'amber'] } as const
type Flag = keyof typeof FLAG

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('performance.view')
  const params = await searchParams
  const batch = sp(params, 'batch'), flag = sp(params, 'flag') as Flag | '', sort = (sp(params, 'sort') || 'overall') as Dim | 'overall' | 'readiness' | 'trend'
  const filter: Record<string, unknown> = { ...(await studentScope(me)), status: { $ne: 'withdrawn' } }
  if (batch) filter.batch = batch
  const [students, cfg, bOpts] = await Promise.all([Student.find(filter).select('name regNo batch department').lean(), getScoring(), batchOptions()])
  const prof = await profiles(students.map(s => s._id))
  const rows = students.map(s => ({ s, p: prof.get(String(s._id))! }))
  const scored = rows.filter(r => r.p.overall != null)
  const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
  const val = (r: (typeof rows)[number]) => (sort === 'overall' ? r.p.overall : sort === 'readiness' ? r.p.readiness : sort === 'trend' ? r.p.trend : r.p.dims[sort])
  const shown = rows.filter(r => !flag || r.p.flags[flag]).sort((a, b) => (val(b) ?? -999) - (val(a) ?? -999))

  const bins = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}–${i * 10 + 10}`, students: 0 }))
  scored.forEach(r => bins[Math.min(9, Math.floor(r.p.overall! / 10))].students++)
  const dimAvg = (Object.keys(DIMENSIONS) as Dim[]).map(d => ({ dim: DIMENSIONS[d], avg: Math.round((mean(rows.map(r => r.p.dims[d])) ?? 0) * 10) / 10 }))
  const batches = await Batch.find({ _id: { $in: [...new Set(students.map(s => String(s.batch)).filter(x => x !== 'undefined' && x !== 'null'))] } }).select('name').lean()
  const cohort = batches.map(b => {
    const rs = rows.filter(r => String(r.s.batch) === String(b._id))
    return { batch: b.name, overall: Math.round((mean(rs.map(r => r.p.overall)) ?? 0) * 10) / 10, readiness: Math.round((mean(rs.map(r => r.p.readiness)) ?? 0) * 10) / 10 }
  })
  const count = (f: Flag) => rows.filter(r => r.p.flags[f]).length
  const qs = (k: string, v: string) => { const u = new URLSearchParams(params); if (v) u.set(k, v); else u.delete(k); return `/performance?${u}` }

  return (
    <>
      <PageHeader title="Performance Intelligence" description="Computed from recorded assessments and attendance only — nothing is estimated or filled in.">
        {can(me, 'reports.export') && <a className="btn-outline" href={`/api/reports/performance?format=xlsx${batch ? `&batch=${batch}` : ''}`}><Download className="size-4" />Export</a>}
      </PageHeader>
      <Grid>
        <Stat label="Average overall" value={<Score value={mean(rows.map(r => r.p.overall))} />} hint={`${scored.length} of ${rows.length} students have results`} />
        <Stat label="Average readiness" value={<Score value={mean(rows.map(r => r.p.readiness))} />} />
        <Stat label="High performers" value={count('high')} href={qs('flag', 'high')} />
        <Stat label="Needs attention" value={count('attention')} href={qs('flag', 'attention')} hint={`${count('declining')} declining · ${count('improving')} improving`} />
      </Grid>
      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card title="Overall score distribution"><Bars data={bins} x="range" series={[{ key: 'students', label: 'Students' }]} height={220} /></Card>
        <Card title="Category-wise average"><Bars data={dimAvg} x="dim" series={[{ key: 'avg', label: 'Average' }]} domain={[0, 100]} height={220} /></Card>
      </div>
      {cohort.length > 1 && <Card title="Cohort comparison by batch" className="mb-6"><Bars data={cohort} x="batch" series={[{ key: 'overall', label: 'Overall' }, { key: 'readiness', label: 'Readiness' }]} domain={[0, 100]} height={220} /></Card>}

      <Card pad={false}>
        <Filters params={params} q={false}>
          <Select name="batch" value={batch} options={bOpts} all="All batches" />
          <Select name="flag" value={flag} options={Object.entries(FLAG).map(([k, [l]]) => [k, l])} all="All students" />
          <Select name="sort" value={sort} options={[['overall', 'Sort: overall'], ['readiness', 'Sort: readiness'], ['trend', 'Sort: trend'], ...(Object.entries(DIMENSIONS).map(([k, l]) => [k, `Sort: ${l}`] as [string, string]))]} all={false} />
        </Filters>
        <Table head={['Student', 'Overall', 'Readiness', ...Object.values(DIMENSIONS), 'Trend', 'Flags']}>
          {shown.map(({ s, p }) => (
            <tr key={String(s._id)} className="hover:bg-subtle/50">
              <td className="td"><Link href={`/students/${s._id}`} className="font-medium hover:underline">{s.name}</Link><div className="font-mono text-xs text-muted">{s.regNo}</div></td>
              <td className="td"><Score value={p.overall} /></td>
              <td className="td"><Score value={p.readiness} /></td>
              {(Object.keys(DIMENSIONS) as Dim[]).map(d => <td key={d} className="td"><Score value={p.dims[d]} /></td>)}
              <td className="td tabular-nums text-xs">{p.trend == null ? <span className="text-muted">—</span> : `${p.trend > 0 ? '+' : ''}${p.trend.toFixed(1)}`}</td>
              <td className="td"><div className="flex flex-wrap gap-1">{(Object.keys(FLAG) as Flag[]).filter(f => p.flags[f]).map(f => <Badge key={f} tone={FLAG[f][1]}>{FLAG[f][0]}</Badge>)}</div></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="How scores are calculated" className="mt-6"><div id="formula"><Formula cfg={cfg} /></div>
        {can(me, 'settings.edit') && <Link href="/settings" className="mt-4 inline-block text-sm text-accent hover:underline">Change weights and thresholds in Settings →</Link>}
      </Card>
    </>
  )
}
