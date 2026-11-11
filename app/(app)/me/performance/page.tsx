import { requireStudent } from '@/lib/auth'
import { journey } from '@/lib/journey'
import { getScoring } from '@/lib/settings'
import { Student } from '@/models'
import { Card, PageHeader } from '@/components/ui'
import { ScoreTiles } from '@/components/score-tiles'
import { Bars, Lines } from '@/components/charts'
import { EvaluationList } from '@/components/evaluation-list'
import { Formula } from '@/components/formula'

export const metadata = { title: 'My Performance' }

export default async function MyPerformance() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('batch').lean()
  const [j, cfg] = await Promise.all([journey(me.student, s?.batch), getScoring()])
  const dims = Object.entries(j.p.byCategory).map(([dim, v]) => ({ dim, score: Math.round(v * 10) / 10 }))
  return (
    <>
      <PageHeader title="My Performance" description="Calculated only from your recorded results and attendance." />
      <ScoreTiles p={j.p} explain="#formula" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Assessment trend"><Lines data={j.trend} x="date" series={[{ key: 'pct', label: 'Score %' }]} domain={[0, 100]} height={220} /></Card>
        <Card title="Assessments by category"><Bars data={dims} x="dim" series={[{ key: 'score', label: 'Score' }]} domain={[0, 100]} height={220} /></Card>
        <Card title="Weekly average"><Bars data={j.weekly.map(w => ({ week: w.key, avg: Math.round(w.avg * 10) / 10 }))} x="week" series={[{ key: 'avg', label: 'Average %' }]} domain={[0, 100]} height={200} /></Card>
        <Card title="Monthly average"><Bars data={j.monthly.map(w => ({ month: w.key, avg: Math.round(w.avg * 10) / 10 }))} x="month" series={[{ key: 'avg', label: 'Average %' }]} domain={[0, 100]} height={200} /></Card>
      </div>
      <Card title="Mentor feedback" className="mt-6"><EvaluationList items={j.evaluations} mentorName={j.mentorName} /></Card>
      <Card title="How your scores are calculated" className="mt-6"><div id="formula"><Formula cfg={cfg} /></div></Card>
    </>
  )
}
