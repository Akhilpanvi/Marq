import { currentUser, can } from '@/lib/auth'
import { xlsx } from '@/lib/sheet'

export async function GET() {
  if (!can(await currentUser(), 'students.create')) return new Response('Forbidden', { status: 403 })
  const body = await xlsx([
    {
      name: 'Students',
      columns: ['Registration Number', 'Full Name', 'University Email', 'Personal Email', 'Mobile Number', 'Department', 'Specialization', 'Academic Year', 'Section', 'Batch', 'Mentor Email', 'Cohort Status'],
      rows: [],
    },
    {
      name: 'Instructions',
      columns: ['Column', 'Required', 'Notes'],
      rows: [
        ['Registration Number', 'Yes', 'Unique. Letters, digits and hyphens. Re-importing updates the student.'],
        ['Full Name', 'Yes', ''],
        ['University Email', 'Yes', 'Unique. Used to sign in once an account is created.'],
        ['Batch', 'No', 'Must match an existing batch name exactly.'],
        ['Mentor Email', 'No', 'Email of an existing mentor/faculty account.'],
        ['Cohort Status', 'No', 'active (default), on_hold, withdrawn, completed'],
        ['Passwords', '—', 'Never put passwords in this file. Accounts are invited from MARQ.'],
      ],
    },
  ])
  return new Response(body, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="marq-student-import-template.xlsx"' } })
}
