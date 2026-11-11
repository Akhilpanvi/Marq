import { currentUser, can } from '@/lib/auth'
import { xlsx } from '@/lib/sheet'

const COLUMNS = ['Registration Number', 'Full Name', 'University Email', 'Placement Mail ID', 'Mobile Number', 'Department', 'Specialization', 'Academic Year', 'Section', 'Batch', 'Mentor Email', 'Cohort Status']

// Clearly fictional example rows — they show the format only.
const SAMPLE = [
  ['2300039999', 'Sample Student One', '2300039999@kluniversity.in', 'sample.one@example.com', '9876500001', 'CSE', 'CSE-H', '3', 'S1', '', '', 'active'],
  ['2300049998', 'Sample Student Two', '', '', '', 'CSE', 'AI&DS', '3', '', '', '', ''],
  ['2300059997', 'Sample Student Three', '2300059997@kluniversity.in', 'sample.three@example.com', '9876500003', 'ECE', '', '3', 'S2', '', '', 'on_hold'],
]

export async function GET(req: Request) {
  if (!can(await currentUser(), 'students.create')) return new Response('Forbidden', { status: 403 })
  const sample = new URL(req.url).searchParams.get('sample') === '1'
  const body = await xlsx([
    { name: 'Students', columns: COLUMNS, rows: sample ? SAMPLE : [] },
    {
      name: 'Instructions',
      columns: ['Column', 'Required', 'Notes'],
      rows: [
        ['Registration Number', 'Yes', 'Unique. Letters, digits and hyphens. Re-importing updates the student. "Student ID NO" also works as the heading.'],
        ['Full Name', 'Yes', '"Name" or "Student Name" also work.'],
        ['University Email', 'No', 'Unique. Left blank → <registration number>@kluniversity.in. Students register with this email.'],
        ['Placement Mail ID', 'No', 'The email the student uses for placement drives.'],
        ['Department', 'No', 'e.g. CSE. A roster with "Parent Branch" + "Branch" columns is read as Department + Specialization.'],
        ['Specialization', 'No', 'e.g. CSE-H, AI&DS.'],
        ['Batch', 'No', 'Must match an existing batch name exactly.'],
        ['Mentor Email', 'No', 'Email of an existing mentor/faculty account.'],
        ['Cohort Status', 'No', 'active (default), on_hold, withdrawn, completed'],
        ['Other columns', '—', 'Ignored. Column order does not matter.'],
        ['Passwords', '—', 'Never put passwords in this file. Students register themselves, or accounts are invited from MARQ.'],
      ],
    },
  ])
  const file = sample ? 'marq-student-import-sample.xlsx' : 'marq-student-import-template.xlsx'
  return new Response(body, { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${file}"` } })
}
