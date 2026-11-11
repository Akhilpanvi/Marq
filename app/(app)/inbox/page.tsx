import { MessageSquareHeart } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { ago } from '@/lib/format'
import { Feedback } from '@/models'
import { Badge, Card, Empty, Grid, PageHeader, Stat } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp } from '@/components/list'
import { ActionButton } from '@/components/form'
import { setFeedbackStatus } from '@/app/actions/feedback'

export const metadata = { title: 'Feedback Inbox' }

export default async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('feedback.view')
  const params = await searchParams
  const page = pageOf(params)
  const status = sp(params, 'status'), category = sp(params, 'category')
  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (category) filter.category = category
  const [items, total, counts, avg] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Feedback.countDocuments(filter),
    Feedback.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Feedback.aggregate<{ _id: null; avg: number; n: number }>([{ $match: { rating: { $gte: 1 } } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
  ])
  const c = (k: string) => counts.find(x => x._id === k)?.n ?? 0
  return (
    <>
      <PageHeader title="Feedback Inbox" description="Messages from students, staff and visitors via the Feedback page." />
      <Grid cols={3}>
        <Stat label="New" value={c('new')} href="/inbox?status=new" />
        <Stat label="Resolved" value={c('resolved')} href="/inbox?status=resolved" />
        <Stat label="Average rating" value={avg[0] ? `${avg[0].avg.toFixed(1)} ★` : '—'} hint={avg[0] ? `${avg[0].n} ratings` : undefined} />
      </Grid>
      <Card pad={false} className="mt-6">
        <Filters params={params} q={false}>
          <Select name="status" value={status} options={[['new', 'New'], ['resolved', 'Resolved']]} all="All" />
          <Select name="category" value={category} options={['Suggestion', 'Bug', 'Question', 'Praise', 'Other']} all="All types" />
        </Filters>
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map(f => (
              <li key={String(f._id)} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={f.category === 'Bug' ? 'red' : f.category === 'Praise' ? 'green' : 'blue'}>{f.category}</Badge>
                    {f.rating ? <span className="text-amber-500">{'★'.repeat(f.rating)}</span> : null}
                    <span className="font-medium">{f.name}</span>
                    <a href={`mailto:${f.email}`} className="text-accent hover:underline">{f.email}</a>
                    <span className="text-muted">· {f.role}{f.user ? ' · signed in' : ''}</span>
                  </div>
                  <p className="mt-1.5 text-sm whitespace-pre-line">{f.message}</p>
                  <p className="mt-1 text-xs text-muted">{ago(f.createdAt)}{f.page ? ` · from ${f.page}` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={f.status === 'new' ? 'amber' : 'zinc'}>{f.status}</Badge>
                  {can(me, 'feedback.edit') && <ActionButton action={setFeedbackStatus} fields={{ id: String(f._id), status: f.status === 'new' ? 'resolved' : 'new' }} className="btn-ghost px-2 py-1 text-xs">{f.status === 'new' ? 'Mark resolved' : 'Reopen'}</ActionButton>}
                </div>
              </li>
            ))}
          </ul>
        ) : <div className="p-5"><Empty icon={MessageSquareHeart}>No feedback yet.</Empty></div>}
        <Pager page={page} total={total} params={params} path="/inbox" />
      </Card>
    </>
  )
}
