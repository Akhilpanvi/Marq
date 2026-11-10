import Link from 'next/link'
import { Bell } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { ago } from '@/lib/format'
import { Notification } from '@/models'
import { Card, Empty, PageHeader } from '@/components/ui'
import { Pager, PAGE_SIZE, pageOf } from '@/components/list'
import { ActionButton } from '@/components/form'
import { markRead } from '@/app/actions/notifications'
import { MarqMark } from '@/components/logo'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser()
  const params = await searchParams
  const page = pageOf(params)
  const [items, total, unread] = await Promise.all([
    Notification.find({ user: me._id }).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Notification.countDocuments({ user: me._id }),
    Notification.countDocuments({ user: me._id, read: false }),
  ])
  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread`}>
        {unread > 0 && <ActionButton action={markRead} fields={{}}>Mark all as read</ActionButton>}
      </PageHeader>
      <Card pad={false}>
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map(n => (
              <li key={String(n._id)} className={`flex items-start gap-3 px-5 py-4 ${n.read ? '' : 'bg-accent-soft/40'}`}>
                <span className="relative mt-0.5 shrink-0"><MarqMark className="size-6" /><span className={`absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-surface ${n.read ? 'bg-line' : 'bg-accent'}`} aria-label={n.read ? 'Read' : 'Unread'} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}</div>
                  {n.body && <p className="mt-0.5 text-sm whitespace-pre-line text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{ago(n.createdAt)}</p>
                </div>
                {!n.read && <ActionButton action={markRead} fields={{ id: String(n._id) }} className="btn-ghost px-2 py-1 text-xs">Mark read</ActionButton>}
              </li>
            ))}
          </ul>
        ) : <div className="p-5"><Empty icon={Bell}>No notifications yet.</Empty></div>}
        <Pager page={page} total={total} params={params} path="/notifications" />
      </Card>
    </>
  )
}
