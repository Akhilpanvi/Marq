import { ExternalLink, RefreshCw } from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { currentTarget, istDay, ranked, standings } from '@/lib/coding'
import { formulaText, PLATFORMS, PLATFORM_KEYS, targetFlag } from '@/lib/coding-points'
import { ago, day, fmt } from '@/lib/format'
import { CodingStat, ScoreSnapshot, Student } from '@/models'
import { Badge, Card, Empty, Field, Grid, PageHeader, Stat } from '@/components/ui'
import { ActionForm } from '@/components/form'
import { Donut, Lines } from '@/components/charts'
import { FlagBadge } from '@/components/coding-ui'
import { saveHandles, syncMine } from '@/app/actions/coding'

export const metadata = { title: 'Coding Profiles' }

export default async function MyCoding() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('handles batch onLeaderboard').lean()
  if (!s) return null
  const [stats, table, history, target] = await Promise.all([
    CodingStat.find({ student: s._id }).lean(),
    standings(),
    ScoreSnapshot.find({ student: s._id }).sort({ day: 1 }).limit(180).lean(),
    currentTarget(s.batch),
  ])
  const mine = table.find(r => String(r._id) === String(s._id))
  const batchRows = ranked(table.filter(r => s.batch && String(r.batch) === String(s.batch)))
  const batchRank = batchRows.find(r => String(r._id) === String(s._id))?.rank
  const points = stats.reduce((t, x) => t + (x.points ?? 0), 0)
  const by = Object.fromEntries(stats.map(x => [x.platform, x]))
  const linked = PLATFORM_KEYS.some(p => s.handles?.[p])
  const synced = stats.map(x => x.fetchedAt).filter(Boolean).sort((a, b) => +a! - +b!)[0]

  return (
    <>
      <PageHeader title="Coding Profiles" description="Your LeetCode, CodeChef and Codeforces activity, combined into coding points and a cohort rank. Refreshed daily.">
        {linked && <ActionForm action={syncMine} className="inline" reset={false}><button className="btn-outline"><RefreshCw className="size-4" />Sync now</button></ActionForm>}
      </PageHeader>

      <Grid>
        <Stat label="Coding points" value={fmt(points)} hint={synced ? `Synced ${ago(synced)}` : 'Not synced yet'} />
        <Stat label="Cohort rank" value={mine ? `#${mine.rank}` : '—'} hint={mine ? `of ${table.length} students` : s.onLeaderboard === false ? 'Hidden from leaderboard (Profile)' : undefined} href="/me/leaderboard" />
        <Stat label="Batch rank" value={batchRank ? `#${batchRank}` : '—'} hint={batchRank ? `of ${batchRows.length}` : 'No batch yet'} />
        <Stat label={target ? `${target.name} · due ${day(target.due)}` : 'Target'} value={target ? fmt(target.points) : '—'} hint={target ? <FlagBadge flag={targetFlag(points, target.points)} /> : 'No target set for your batch'} />
      </Grid>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Rank history" className="lg:col-span-2">
          {history.length > 1
            ? <Lines data={history.map(h => ({ day: h.day.slice(5), rank: h.rank ?? null }))} x="day" series={[{ key: 'rank', label: 'Cohort rank' }]} reversed height={220} />
            : <Empty>Your rank is recorded daily; the chart appears after two days of data{history.length ? ` (today: #${history[0].rank})` : ''}.</Empty>}
        </Card>
        <Card title="Points by platform">
          <Donut data={PLATFORM_KEYS.filter(p => by[p]?.points).map(p => ({ name: PLATFORMS[p].label, value: by[p]!.points }))} height={180} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {PLATFORM_KEYS.map(p => {
          const x = by[p]
          return (
            <Card key={p} title={PLATFORMS[p].label} action={x?.handle ? <a href={PLATFORMS[p].url(x.handle)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-accent hover:underline">{x.handle}<ExternalLink className="size-3" /></a> : undefined}>
              {!x ? <Empty>Add your {PLATFORMS[p].label} username below.</Empty> : x.status === 'not_found' ? <Empty>No {PLATFORMS[p].label} account named “{x.handle}”. Check the username.</Empty> : (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {([['Current rating', x.rating], ['Highest rating', x.maxRating], ['Contests', x.contests], ['Rating change', x.lastChange == null ? null : `${x.lastChange > 0 ? '+' : ''}${x.lastChange}`], ...(p !== 'codeforces' ? [['Problems solved', x.solved]] : []), ['Points', x.points]] as [string, unknown][]).map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-line p-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-semibold tabular-nums">{v == null ? '—' : typeof v === 'number' ? fmt(v) : String(v)}</dd></div>
                    ))}
                  </dl>
                  {p === 'leetcode' && x.solved ? <p className="mt-3 text-xs text-muted">Easy {x.easy ?? 0} · Medium {x.medium ?? 0} · Hard {x.hard ?? 0}</p> : null}
                  {x.history.length > 1 && <div className="mt-3"><Lines data={x.history.map(h => ({ at: h.at ? new Date(h.at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '', rating: h.rating ?? null }))} x="at" series={[{ key: 'rating', label: 'Rating' }]} height={130} /></div>}
                  {x.status === 'error' && <p className="mt-2 text-xs text-amber-600">Last refresh failed; showing the previous numbers.</p>}
                  <p className="mt-2 text-[11px] text-muted">Points: {formulaText(p)}</p>
                </>
              )}
            </Card>
          )
        })}
      </div>

      <Card title="Usernames" className="mt-6">
        <ActionForm action={saveHandles} submit="Save & sync" reset={false}>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLATFORM_KEYS.map(p => <Field key={p} label={PLATFORMS[p].label}><input name={p} defaultValue={s.handles?.[p] ?? ''} maxLength={40} autoComplete="off" className="input" placeholder="username" /></Field>)}
          </div>
          <p className="text-xs text-muted">Only public profile data is read. Ranks are recorded once a day ({istDay()} so far).</p>
        </ActionForm>
      </Card>
      {!linked && <p className="mt-3"><Badge tone="amber">Add at least one username to appear on the leaderboard with points.</Badge></p>}
    </>
  )
}
