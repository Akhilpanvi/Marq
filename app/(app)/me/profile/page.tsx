import { requireStudent } from '@/lib/auth'
import { avatarSrc } from '@/lib/avatar'
import { Batch, Student, User } from '@/models'
import { Avatar, Card, Field, KV, PageHeader } from '@/components/ui'
import { ActionForm } from '@/components/form'
import { STATUS_LABEL } from '@/components/student-fields'
import { updateMyProfile } from '@/app/actions/me'
import { saveProfessional } from '@/app/actions/coding'

export const metadata = { title: 'My Profile' }

export default async function MyProfile() {
  const me = await requireStudent()
  const s = await Student.findById(me.student).lean()
  if (!s) return null
  const [batch, mentor] = await Promise.all([s.batch ? Batch.findById(s.batch).select('name').lean() : null, s.mentor ? User.findById(s.mentor).select('name email').lean() : null])
  return (
    <>
      <PageHeader title="My Profile" description="Academic details are maintained by the programme office. You can update your contact details and picture (your GitHub picture is used automatically)." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Academic record" className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-4"><Avatar name={s.name} src={avatarSrc(s)} size="size-16" /><div><div className="text-lg font-semibold">{s.name}</div><div className="font-mono text-sm text-muted">{s.regNo}</div></div></div>
          <KV items={[['University email', s.email], ['Department', s.department], ['Specialization', s.specialization], ['Academic year', s.year], ['Section', s.section], ['Batch', batch?.name], ['Mentor', mentor ? `${mentor.name} (${mentor.email})` : undefined], ['Cohort status', STATUS_LABEL[s.status ?? 'active']]]} />
        </Card>
        <Card title="Contact details">
          <ActionForm action={updateMyProfile} submit="Save" reset={false}>
            <Field label="Mobile number"><input name="phone" type="tel" defaultValue={s.phone ?? ''} className="input" /></Field>
            <Field label="Placement mail ID"><input name="personalEmail" type="email" defaultValue={s.personalEmail ?? ''} className="input" /></Field>
            <Field label="Profile picture link" hint="Google Drive share link (Anyone with the link can view). Leave blank to use the GitHub profile picture."><input name="photoUrl" type="url" placeholder="https://drive.google.com/file/d/…/view" defaultValue={s.photoUrl ?? ''} className="input" /></Field>
          </ActionForm>
        </Card>
        <Card title="Professional details" className="lg:col-span-3">
          <ActionForm action={saveProfessional} submit="Save" reset={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline" className="sm:col-span-2"><input name="headline" maxLength={140} defaultValue={s.professional?.headline ?? ''} placeholder="Aspiring backend engineer · Java, Spring, SQL" className="input" /></Field>
              <Field label="LinkedIn"><input name="linkedin" type="url" defaultValue={s.professional?.linkedin ?? ''} className="input" /></Field>
              <Field label="GitHub"><input name="github" type="url" defaultValue={s.professional?.github ?? ''} className="input" /></Field>
              <Field label="Portfolio"><input name="portfolio" type="url" defaultValue={s.professional?.portfolio ?? ''} className="input" /></Field>
              <Field label="Resume link"><input name="resume" type="url" defaultValue={s.professional?.resume ?? ''} className="input" /></Field>
              <Field label="Skills" hint="Comma separated" className="sm:col-span-2"><input name="skills" defaultValue={(s.professional?.skills ?? []).join(', ')} className="input" /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="onLeaderboard" defaultChecked={s.onLeaderboard !== false} className="size-4 accent-brand-600" />Show me on the cohort leaderboards (name, department and coding points)</label>
          </ActionForm>
        </Card>
      </div>
    </>
  )
}
