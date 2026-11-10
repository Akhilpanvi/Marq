import Link from 'next/link'
import { Download, Plus, Upload } from 'lucide-react'
import { can, requirePage, studentScope } from '@/lib/auth'
import { batchOptions, mentorOptions } from '@/lib/options'
import { profiles } from '@/lib/intel'
import { Batch, Student, User } from '@/models'
import { Avatar, Badge, Card, PageHeader, Score, Table } from '@/components/ui'
import { Filters, Pager, PAGE_SIZE, pageOf, Select, sp, escapeRe } from '@/components/list'
import { ActionForm, Modal } from '@/components/form'
import { StudentFields, STATUS_LABEL } from '@/components/student-fields'
import { BulkBar, SelectAll } from '@/components/students-client'
import { saveStudent } from '@/app/actions/students'

export const metadata = { title: 'Students' }

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requirePage('students.view')
  const params = await searchParams
  const page = pageOf(params)
  const q = sp(params, 'q'), batch = sp(params, 'batch'), mentor = sp(params, 'mentor'), status = sp(params, 'status'), dept = sp(params, 'department')
  const filter: Record<string, unknown> = { ...(await studentScope(me)) }
  if (q) filter.$and = [{ $or: [{ name: new RegExp(escapeRe(q), 'i') }, { regNo: new RegExp(escapeRe(q), 'i') }, { email: new RegExp(escapeRe(q), 'i') }] }]
  if (batch) filter.batch = batch === 'none' ? null : batch
  if (mentor) filter.mentor = mentor === 'none' ? null : mentor
  if (status) filter.status = status
  if (dept) filter.department = dept

  const [students, total, batches, mentors, departments] = await Promise.all([
    Student.find(filter).select('-photo.data').sort({ regNo: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Student.countDocuments(filter),
    batchOptions(),
    mentorOptions(),
    Student.distinct('department', await studentScope(me)),
  ])
  const ids = students.map(s => s._id)
  const [scores, accounts, batchNames] = await Promise.all([
    profiles(ids),
    User.find({ student: { $in: ids } }).select('student status').lean(),
    Batch.find({ _id: { $in: students.flatMap(s => (s.batch ? [s.batch] : [])) } }).select('name').lean(),
  ])
  const acct = new Map(accounts.map(a => [String(a.student), a.status]))
  const bName = new Map(batchNames.map(b => [String(b._id), b.name]))
  const mName = new Map(mentors)
  const canEdit = can(me, 'students.edit'), canAccounts = can(me, 'users.create')

  return (
    <>
      <PageHeader title={me.scope === 'assigned' ? 'My Students' : 'Students'} description={me.scope === 'assigned' ? 'Students you mentor or train.' : 'The Marquee cohort: records, batches, mentors and accounts.'}>
        {can(me, 'students.export') && <a className="btn-outline" href={`/api/reports/students?format=xlsx`}><Download className="size-4" />Export</a>}
        {can(me, 'students.create') && <Link className="btn-outline" href="/students/import"><Upload className="size-4" />Bulk import</Link>}
        {can(me, 'students.create') && (
          <Modal label={<><Plus className="size-4" />Add student</>} title="Add student" wide>
            <ActionForm action={saveStudent} submit="Add student"><StudentFields batches={batches} mentors={mentors} /></ActionForm>
          </Modal>
        )}
      </PageHeader>
      <Card pad={false}>
        <Filters params={params} placeholder="Search name, registration no or email">
          <Select name="batch" value={batch} options={[['none', 'No batch'], ...batches]} all="All batches" />
          {me.scope === 'all' && <Select name="mentor" value={mentor} options={[['none', 'No mentor'], ...mentors]} all="All mentors" />}
          <Select name="department" value={dept} options={departments.filter(Boolean).sort()} all="All departments" />
          <Select name="status" value={status} options={Object.entries(STATUS_LABEL)} all="All statuses" />
        </Filters>
        <BulkBar batches={batches} mentors={mentors} canEdit={canEdit} canAccounts={canAccounts} />
        <Table head={[(canEdit || canAccounts) ? <SelectAll key="a" /> : '', 'Student', 'Department', 'Batch', 'Mentor', 'Overall', 'Attendance', 'Account', 'Status']}
          empty={<div className="text-center text-sm text-muted">{total === 0 && !q ? 'No students yet. Add one or use Bulk import.' : 'No students match these filters.'}</div>}>
          {students.map(s => {
            const p = scores.get(String(s._id))
            const a = acct.get(String(s._id))
            return (
              <tr key={String(s._id)} className="hover:bg-subtle/50">
                <td className="td w-8">{(canEdit || canAccounts) && <input type="checkbox" name="ids" value={String(s._id)} form="bulk" aria-label={`Select ${s.name}`} className="size-4 accent-brand-600" />}</td>
                <td className="td">
                  <Link href={`/students/${s._id}`} className="flex items-center gap-2.5">
                    <Avatar name={s.name} src={s.photo?.type ? `/api/students/${s._id}/photo` : null} size="size-8" />
                    <span className="min-w-0"><span className="block truncate font-medium hover:underline">{s.name}</span><span className="block font-mono text-xs text-muted">{s.regNo}</span></span>
                  </Link>
                </td>
                <td className="td">{s.department || '—'}{s.section ? <span className="text-muted"> · {s.section}</span> : null}</td>
                <td className="td">{s.batch ? bName.get(String(s.batch)) : <span className="text-muted">—</span>}</td>
                <td className="td">{s.mentor ? mName.get(String(s.mentor)) ?? '—' : <span className="text-muted">—</span>}</td>
                <td className="td"><Score value={p?.overall} /></td>
                <td className="td"><Score value={p?.dims.attendance} /></td>
                <td className="td">{a ? <Badge tone={a === 'active' ? 'green' : a === 'invited' ? 'amber' : 'zinc'}>{a}</Badge> : <span className="text-xs text-muted">none</span>}</td>
                <td className="td"><Badge tone={s.status === 'active' ? 'green' : s.status === 'withdrawn' ? 'red' : 'zinc'}>{STATUS_LABEL[s.status ?? 'active']}</Badge></td>
              </tr>
            )
          })}
        </Table>
        <Pager page={page} total={total} params={params} path="/students" />
      </Card>
    </>
  )
}
