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
  interviews: 'Interviews',
  reports: 'Reports',
  announcements: 'Announcements',
  finance: 'Financial Records',
  audit: 'Audit Logs',
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
    key: 'admin', name: 'Administrator', scope: 'all', description: 'Student information, operations and authorized reports.',
    perms: [...all('students'), ...all('announcements'), ...view('users', 'training', 'attendance', 'assessments', 'performance', 'mentorship', 'companies', 'jobs', 'applications', 'interviews'), ...all('reports', 'view', 'export')],
  },
  {
    key: 'admin_assistant', name: 'Admin Assistant', scope: 'all', description: 'Student records, onboarding, bulk uploads and student accounts.',
    perms: [...all('students', 'view', 'create', 'edit', 'export'), ...all('users', 'view', 'create', 'edit'), ...all('reports', 'view', 'export'), ...all('attendance', 'view', 'create'), 'training.view'],
  },
  {
    key: 'director', name: 'Director', scope: 'all', description: 'Executive read-only view of the whole programme.',
    perms: [...view('students', 'training', 'attendance', 'assessments', 'performance', 'mentorship', 'companies', 'jobs', 'applications', 'interviews', 'announcements'), ...all('reports', 'view', 'export'), 'attendance.approve'],
  },
  {
    key: 'director_accounts', name: 'Director Accounts', scope: 'all', description: 'Training expenditure, budget and financial reports.',
    perms: [...all('finance', 'view', 'approve', 'export'), 'reports.view'],
  },
  {
    key: 'training_admin', name: 'Training Administrator', scope: 'all', description: 'Schedules, attendance, trainer allocation and assessments.',
    perms: [...all('training'), ...all('attendance'), ...all('assessments'), ...view('students', 'performance', 'mentorship', 'users'), ...all('reports', 'view', 'export'), ...all('announcements', 'view', 'create'), 'finance.create', 'finance.view'],
  },
  {
    key: 'placement_admin', name: 'Placement Administrator', scope: 'all', description: 'Companies, opportunities, applications and interviews.',
    perms: [...all('companies'), ...all('jobs'), ...all('applications'), ...all('interviews'), ...view('students', 'performance'), ...all('reports', 'view', 'export'), ...all('announcements', 'view', 'create')],
  },
  {
    key: 'mentor', name: 'Mentor', scope: 'assigned', description: 'Assigned students: evaluations, feedback and progress.',
    perms: [...view('students', 'performance', 'attendance', 'assessments', 'applications', 'interviews', 'training'), ...all('mentorship', 'view', 'create', 'edit'), 'reports.view'],
  },
  {
    key: 'trainer', name: 'Trainer', scope: 'assigned', description: 'Own batches: sessions, attendance, assessment marks and feedback.',
    perms: [...view('students', 'performance', 'training'), ...all('attendance', 'view', 'create', 'edit'), ...all('assessments', 'view', 'create', 'edit'), ...all('mentorship', 'view', 'create'), 'reports.view'],
  },
  { key: 'student', name: 'Student', scope: 'assigned', portal: 'student', perms: [], description: 'Own dashboard, training, results and applications.' },
]

export const ACCOUNT_TYPES = ['administrative', 'faculty', 'mentor', 'trainer', 'student'] as const
