import type { Types } from 'mongoose'
import { requireStudent } from '@/lib/auth'
import { PLATFORMS, PLATFORM_KEYS, type PlatformKey } from '@/lib/coding-points'
import { fmt } from '@/lib/format'
import { Batch, CodingStat, Student } from '@/models'
import { Card, Empty, PageHeader, Table } from '@/components/ui'
import { sp } from '@/components/list'
import { Chips } from '@/components/coding-ui'

export const metadata = { title: 'Contest Leaderboard' }

export default async function Contests({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireStudent()
  const params = await searchParams
  const platform = (PLATFORM_KEYS.includes(sp(params, 'platform') as PlatformKey) ? sp(params, 'platform') : 'leetcode') as PlatformKey
  const s = await Student.findById(me.student).select('batch').lean()
  const scope = sp(params, 'scope') === 'batch' && s?.batch ? 'batch' : 'all'
  const students = await Student.find({ status: { $nin: ['withdrawn', 'dropped'] }, onLeaderboard: { $ne: false }, ...(scope === 'batch' ? { batch: s!.batch } : {}) }).select('name department').lean()
  const stats = await CodingStat.find({ platform, status: 'ok', student: { $in: students.map(x => x._id as Types.ObjectId) }, rating: { $gt: 0 } }).select('student rating maxRating contests lastChange').sort({ rating: -1 }).lean()
  const sName = new Map(students.map(x => [String(x._id), x]))
  const batch = s?.batch ? await Batch.findById(s.batch).select('name').lean() : null
  const qs = (k: string, v: string) => { const u = new URLSearchParams({ platform, ...(scope === 'batch' ? { scope } : {}) }); u.set(k, v); if (k === 'scope' && v === 'all') u.delete('scope'); return `/me/contests?${u}` }

  return (
    <>
      <PageHeader title="Contest Leaderboard" description="Contest ratings of Marquee students, highest first." />
      <Card pad={false}>
        <Chips active={platform} items={PLATFORM_KEYS.map(p => ({ key: p, label: PLATFORMS[p].label, href: qs('platform', p) }))} />
        <Chips active={scope} items={[{ key: 'all', label: 'All students', href: qs('scope', 'all') }, ...(batch ? [{ key: 'batch', label: batch.name, href: qs('scope', 'batch') }] : [])]} />
        <Table head={['#', 'Student', 'Department', 'Contests', 'Current rating', 'Highest', 'Last change']} empty={<Empty>No {PLATFORMS[platform].label} ratings yet.</Empty>}>
          {stats.map((x, i) => {
            const st = sName.get(String(x.student))
            const mine = String(x.student) === String(me.student)
            return (
              <tr key={String(x._id)} className={mine ? 'bg-accent-soft/60 font-medium' : ''}>
                <td className="td tabular-nums">{i + 1}</td>
                <td className="td">{st?.name}{mine && <span className="ml-2 text-xs text-muted">(you)</span>}</td>
                <td className="td text-muted">{st?.department || '—'}</td>
                <td className="td tabular-nums">{x.contests ?? 0}</td>
                <td className="td font-semibold tabular-nums">{fmt(x.rating)}</td>
                <td className="td tabular-nums text-muted">{fmt(x.maxRating)}</td>
                <td className={`td tabular-nums ${(x.lastChange ?? 0) > 0 ? 'text-emerald-600' : (x.lastChange ?? 0) < 0 ? 'text-red-600' : 'text-muted'}`}>{x.lastChange == null ? '—' : `${x.lastChange > 0 ? '+' : ''}${x.lastChange}`}</td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </>
  )
}
