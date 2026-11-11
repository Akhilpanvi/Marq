import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { can, requirePage } from '@/lib/auth'
import { batchOptions } from '@/lib/options'
import { ago } from '@/lib/format'
import { Announcement, Role, User } from '@/models'
import { Badge, Card, Empty, Field, PageHeader } from '@/components/ui'
import { Pager, PAGE_SIZE, pageOf } from '@/components/list'
import { ActionButton, ActionForm, Modal } from '@/components/form'
import { createAnnouncement, deleteAnnouncement } from '@/app/actions/admin'

export const metadata = { title: 'Announcements' }

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('announcements.view')
  const params = await searchParams
  const page = pageOf(params)
  const [items, total, roles, batches] = await Promise.all([
    Announcement.find().sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Announcement.countDocuments(),
    Role.find().select('key name').sort({ name: 1 }).lean(),
    batchOptions(),
  ])
  const authors = new Map((await User.find({ _id: { $in: items.flatMap(i => (i.createdBy ? [i.createdBy] : [])) } }).select('name').lean()).map(u => [String(u._id), u.name]))
  const rName = new Map(roles.map(r => [r.key, r.name]))
  const bName = new Map(batches)

  return (
    <>
      <PageHeader title="Announcements" description="Publish to everyone, to specific roles, or to students in specific batches. Recipients get an in-app notification.">
        {can(me, 'announcements.create') && (
          <Modal label={<><Plus className="size-4" />New announcement</>} title="New announcement" wide>
            <ActionForm action={createAnnouncement} submit="Publish">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Title *" className="sm:col-span-2"><input name="title" required className="input" /></Field>
                <Field label="Category"><select name="category" className="input">{['General', 'Training', 'Assessment', 'Placement', 'Opportunity'].map(c => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <Field label="Message *"><textarea name="body" required rows={5} className="input" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Roles" hint="None selected and no batches = everyone."><select name="roles" multiple className="input h-36">{roles.map(r => <option key={r.key} value={r.key}>{r.name}</option>)}</select></Field>
                <Field label="Student batches"><select name="batches" multiple className="input h-36">{batches.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              </div>
            </ActionForm>
          </Modal>
        )}
      </PageHeader>
      <div className="space-y-4">
        {items.map(a => (
          <Card key={String(a._id)}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{a.category}</Badge><h2 className="font-semibold">{a.title}</h2></div>
                <p className="mt-2 text-sm whitespace-pre-line">{a.body}</p>
                <p className="mt-3 text-xs text-muted">{authors.get(String(a.createdBy)) ?? '—'} · {ago(a.createdAt)} · To: {[...a.roles.map(r => rName.get(r) ?? r), ...a.batches.map(b => bName.get(String(b)) ?? 'batch')].join(', ') || 'Everyone'}</p>
              </div>
              {can(me, 'announcements.delete') && <ActionButton action={deleteAnnouncement} fields={{ id: String(a._id) }} className="btn-ghost px-2 text-red-600" confirm="Remove this announcement?"><Trash2 className="size-4" /></ActionButton>}
            </div>
          </Card>
        ))}
        {!items.length && <Empty icon={Megaphone}>No announcements yet.</Empty>}
      </div>
      {total > PAGE_SIZE && <div className="card mt-4"><Pager page={page} total={total} params={params} path="/announcements" /></div>}
    </>
  )
}
