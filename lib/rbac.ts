// Shared (client + server) permission vocabulary. Enforcement lives in lib/auth.ts.

export const MODULES = {
  users: 'User Management',
  roles: 'Roles & Permissions',
  students: 'Students',
  training: 'Training',
  attendance: 'Attendance',
  assessments: 'Assessments',
  performance: 'Performance Intelligence',
  mentorship: 'Mentorship & Evaluations',
  companies: 'Companies',
  jobs: 'Job Opportunities',
  applications: 'Applications',
  reports: 'Reports',
  announcements: 'Announcements',
  audit: 'Audit Logs',
  feedback: 'Feedback',
  settings: 'Settings',
} as const

export const ACTIONS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export' } as const

export type Module = keyof typeof MODULES
export type Action = keyof typeof ACTIONS
export type Perm = `${Module}.${Action}` | '*'

export const ALL_PERMS = Object.keys(MODULES).flatMap(m => Object.keys(ACTIONS).map(a => `${m}.${a}` as Perm))

export const hasPerm = (perms: readonly string[], p: Perm) => perms.includes('*') || perms.includes(p)

/** `assigned` limits student data to the user's mentees and the batches they train. */
export type Scope = 'all' | 'assigned'

const all = (m: Module, ...a: Action[]) => (a.length ? a : (Object.keys(ACTIONS) as Action[])).map(x => `${m}.${x}` as Perm)
const view = (...ms: Module[]) => ms.map(m => `${m}.view` as Perm)

export const DEFAULT_ROLES: { key: string; name: string; scope: Scope; portal?: 'student'; perms: Perm[]; description: string }[] = [
  { key: 'superadmin', name: 'Super Administrator', scope: 'all', perms: ['*'], description: 'Complete platform control.' },
  {
    key: 'placement_admin', name: 'Placement Admin', scope: 'all', description: 'Runs the programme day to day: students, accounts, daily register, companies, drives, applications, announcements and feedback.',
    perms: [
      ...all('students'), ...all('users', 'view', 'create', 'edit'), ...all('attendance', 'view', 'create'), ...all('announcements'), ...all('feedback', 'view', 'edit'),
      ...all('companies'), ...all('jobs'), ...all('applications'), ...all('reports', 'view', 'export'),
      ...view('training', 'assessments', 'performance', 'mentorship'),
    ],
  },
  { key: 'director', name: 'Director', scope: 'all', description: 'Full access to the whole programme; approves attendance changes.', perms: [...ALL_PERMS] },
  {
    key: 'training_admin', name: 'Training Administrator', scope: 'all', description: 'Schedules, attendance, trainer allocation and assessments.',
    perms: [...all('training'), ...all('attendance'), ...all('assessments'), ...view('students', 'performance', 'mentorship', 'users'), ...all('reports', 'view', 'export'), ...all('announcements', 'view', 'create')],
  },
  {
    key: 'mentor', name: 'Mentor', scope: 'assigned', description: 'Assigned students: evaluations, feedback and progress.',
    perms: [...view('students', 'performance', 'attendance', 'assessments', 'applications', 'training'), ...all('mentorship', 'view', 'create', 'edit'), 'reports.view'],
  },
  {
    key: 'trainer', name: 'Trainer', scope: 'assigned', description: 'Own batches: sessions, attendance, assessment marks and feedback.',
    perms: [...view('students', 'performance', 'training'), ...all('attendance', 'view', 'create', 'edit'), ...all('assessments', 'view', 'create', 'edit'), ...all('mentorship', 'view', 'create'), 'reports.view'],
  },
  { key: 'student', name: 'Student', scope: 'assigned', portal: 'student', perms: [], description: 'Own dashboard, training, results and applications.' },
]

export const ACCOUNT_TYPES = ['administrative', 'faculty', 'mentor', 'trainer', 'student'] as const
