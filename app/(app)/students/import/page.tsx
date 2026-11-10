import { can, requirePage } from '@/lib/auth'
import { PageHeader } from '@/components/ui'
import { ImportWizard } from '@/components/students-client'

export const metadata = { title: 'Import students' }

export default async function ImportPage() {
  const me = await requirePage('students.create')
  return (
    <>
      <PageHeader title="Bulk import students" back={{ href: '/students', label: 'Students' }}
        description="Download the template, fill one row per student, upload, review every row, then confirm. Nothing is written until you confirm." />
      <ImportWizard canUpdate={can(me, 'students.edit')} />
      <p className="mt-4 text-xs text-muted">Batches are matched by name and mentors by account email; create them first. Re-importing the same registration number updates that student instead of duplicating them. Files never contain passwords — accounts are invited separately from the Students list.</p>
    </>
  )
}
