import { requireStudent } from '@/lib/auth'
import { Batch, Student, User } from '@/models'
import { Avatar, Card, Field, KV, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/form'
import { STATUS_LABEL } from '@/components/student-fields'
import { updateMyProfile } from '@/app/actions/me'

export const metadata = { title: 'My Profile' }

export default async function MyProfile() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).select('-photo.data').lean()
  if (!s) return null
  const [batch, mentor] = await Promise.all([s.batch ? Batch.findById(s.batch).select('name').lean() : null, s.mentor ? User.findById(s.mentor).select('name email').lean() : null])
  return (
    <>
      <PageHeader title="My Profile" description="Academic details are maintained by the programme office. You can update your contact details and photo." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Academic record" className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-4"><Avatar name={s.name} src={s.photo?.type ? `/api/students/${s._id}/photo` : null} size="size-16" /><div><div className="text-lg font-semibold">{s.name}</div><div className="font-mono text-sm text-muted">{s.regNo}</div></div></div>
          <KV items={[['University email', s.email], ['Department', s.department], ['Specialization', s.specialization], ['Academic year', s.year], ['Section', s.section], ['Batch', batch?.name], ['Mentor', mentor ? `${mentor.name} (${mentor.email})` : undefined], ['Cohort status', STATUS_LABEL[s.status ?? 'active']]]} />
        </Card>
        <Card title="Contact details">
          <ActionForm action={updateMyProfile} submit="Save" reset={false}>
            <Field label="Mobile number"><input name="phone" type="tel" defaultValue={s.phone ?? ''} className="input" /></Field>
            <Field label="Personal email"><input name="personalEmail" type="email" defaultValue={s.personalEmail ?? ''} className="input" /></Field>
            <Field label="Profile picture" hint="JPEG, PNG or WebP, under 300 KB."><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" /></Field>
          </ActionForm>
        </Card>
      </div>
    </>
  )
}
