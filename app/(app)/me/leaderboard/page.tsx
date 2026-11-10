import { requireStudent } from '@/lib/auth'
import { currentTarget, ranked, standings } from '@/lib/coding'
import { formulaText, PLATFORMS, PLATFORM_KEYS, targetFlag } from '@/lib/coding-points'
import { fmt } from '@/lib/format'
import { Batch, Student } from '@/models'
import { Card, PageHeader, Table } from '@/components/ui'
import { Pager, pageOf, sp } from '@/components/list'
import { Chips, FlagBadge } from '@/components/coding-ui'

export const metadata = { title: 'Leaderboard' }
const SIZE = 50

export default async function Leaderboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireStudent()
  const params = await searchParams
  const s = await Student.findById(me.student).select('batch').lean()
  const scope = sp(params, 'scope') === 'batch' && s?.batch ? 'batch' : 'all'
  const [all, batch, target] = await Promise.all([standings(), s?.batch ? Batch.findById(s.batch).select('name').lean() : null, currentTarget(s?.batch)])
  // batch view re-ranks within the batch
  const rows = scope === 'batch' ? ranked(all.filter(r => String(r.batch) === String(s?.batch))) : all
  const page = pageOf(params)
  const mine = rows.find(r => String(r._id) === String(me.student))
  const shown = rows.slice((page - 1) * SIZE, page * SIZE)

  const row = (r: (typeof rows)[number], pinned = false) => (
    <tr key={`${pinned ? 'me' : ''}${r._id}`} className={pinned || String(r._id) === String(me.student) ? 'bg-accent-soft/60 font-medium' : ''}>
      <td className="td tabular-nums">{r.rank}</td>
      <td className="td">{r.name}{String(r._id) === String(me.student) && <span className="ml-2 text-xs text-muted">(you)</span>}</td>
      <td className="td text-muted">{r.department || '—'}</td>
      {PLATFORM_KEYS.map(p => <td key={p} className="td tabular-nums text-muted">{r.by[p] ? fmt(r.by[p]) : '—'}</td>)}
      <td className="td text-right font-semibold tabular-nums">{fmt(r.points)}</td>
    </tr>
  )

  return (
    <>
      <PageHeader title="Leaderboard" description="Coding points across the Marquee cohort. Students who hid themselves in Profile are not listed." />
      <Card pad={false}>
        <Chips active={scope} items={[{ key: 'all', label: 'All students', href: '/me/leaderboard' }, ...(batch ? [{ key: 'batch', label: batch.name, href: '/me/leaderboard?scope=batch' }] : [])]} />
        {mine && target && scope === 'batch' && <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm"><span className="text-muted">{target.name}: {fmt(target.points)} points</span><FlagBadge flag={targetFlag(mine.points, target.points)} /></div>}
        <Table head={['Rank', 'Student', 'Department', ...PLATFORM_KEYS.map(p => PLATFORMS[p].label), 'Points']}>
          {mine && !shown.includes(mine) && row(mine, true)}
          {shown.map(r => row(r))}
        </Table>
        <Pager page={page} total={rows.length} params={params} path="/me/leaderboard" />
      </Card>
      <p className="mt-3 text-xs text-muted">Points per platform: {PLATFORM_KEYS.map(p => `${PLATFORMS[p].label} = ${formulaText(p)}`).join(' · ')}. Equal points share a rank.</p>
    </>
  )
}
