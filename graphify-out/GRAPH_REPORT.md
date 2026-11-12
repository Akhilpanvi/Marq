# Graph Report - MarQ  (2026-11-12)

## Corpus Check
- 144 files · ~66,089 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 872 nodes · 4181 edges · 31 communities (27 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.83)
- Token cost: 56,173 input · 0 output

## Community Hubs (Navigation)
- Staff Pages
- Admin & Training Actions
- Student & Placement Pages
- Daily Register & Import
- Workflow Doc Concepts
- Data Models
- Scoring & Intelligence
- Login & Password Actions
- Onboarding & App Shell
- Coding Leaderboards UI
- Account & Report Pages
- Dev Dependencies
- Sessions & Access Guards
- TypeScript Config
- Settings, Formula & Reports
- End-to-End Tests
- Login Form & Mail
- Coding Profile Sync
- Database & Health
- Navigation & RBAC
- Report & Template Routes
- Runtime Dependencies
- Root Layout & Theme
- Student Self-Registration
- npm Scripts
- Engines & Overrides
- Vercel Config
- Account Lockout Rule
- Safe Exports Rule
- Training Admin Role

## God Nodes (most connected - your core abstractions)
1. `Invalid` - 83 edges
2. `PageHeader()` - 77 edges
3. `Card()` - 73 edges
4. `audit()` - 70 edges
5. `attempt()` - 70 edges
6. `next` - 64 edges
7. `Badge()` - 60 edges
8. `can()` - 56 edges
9. `guard()` - 55 edges
10. `ActionForm()` - 53 edges

## Surprising Connections (you probably didn't know these)
- `ImportWizard()` --indirect_call--> `previewImport()`  [INFERRED]
  components/students-client.tsx → app/actions/students.ts
- `ImportWizard()` --indirect_call--> `confirmImport()`  [INFERRED]
  components/students-client.tsx → app/actions/students.ts
- `BulkBar()` --indirect_call--> `bulkStudents()`  [INFERRED]
  components/students-client.tsx → app/actions/students.ts
- `GET()` --calls--> `db()`  [EXTRACTED]
  app/api/health/route.ts → lib/db.ts
- `confirm()` --indirect_call--> `day()`  [INFERRED]
  components/register-editor.tsx → lib/format.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MARQ role set** — docs_marq_how_it_works_super_admin, docs_marq_how_it_works_director, docs_marq_how_it_works_placement_admin, docs_marq_how_it_works_training_admin, docs_marq_how_it_works_mentor_trainer, docs_marq_how_it_works_student [EXTRACTED 1.00]
- **Security model (gate, permission/scope, isolation, audit, lockout)** — docs_marq_how_it_works_sign_in_gate, docs_marq_how_it_works_permission_scope_check, docs_marq_how_it_works_data_isolation, docs_marq_how_it_works_audit_log, docs_marq_how_it_works_account_lockout, docs_marq_how_it_works_account_invite_flow, docs_marq_how_it_works_export_safety [EXTRACTED 1.00]
- **Daily attendance workflow** — docs_marq_how_it_works_daily_attendance_register, docs_marq_how_it_works_placement_admin, docs_marq_how_it_works_attendance_change_approval, docs_marq_how_it_works_director, docs_marq_how_it_works_attendance_exports [EXTRACTED 1.00]

## Communities (31 total, 4 thin omitted)

### Community 0 - "Staff Pages"
Cohesion: 0.09
Nodes (112): AnnouncementsPage(), metadata, ApplicationsPage(), metadata, AssessmentPage(), AssessmentsPage(), metadata, AttendancePage() (+104 more)

### Community 1 - "Admin & Training Actions"
Cohesion: 0.10
Nodes (102): CATS, createAnnouncement(), deleteAnnouncement(), saveScoring(), saveStatuses(), access(), deleteAssessment(), Entry (+94 more)

### Community 2 - "Student & Placement Pages"
Cohesion: 0.06
Nodes (70): AccountPage(), metadata, ApplicationPage(), Loading(), metadata, MyApplications(), metadata, metadata (+62 more)

### Community 3 - "Daily Register & Import"
Cohesion: 0.06
Nodes (67): approvers(), readRegisterFile(), Submit, submitRegister(), today(), ImportRow, GET(), Locked() (+59 more)

### Community 4 - "Workflow Doc Concepts"
Cohesion: 0.06
Nodes (26): Attendance downloads (day sheet & consolidated workbook), Batch coding targets (met / work harder / improve immediately), LeetCode / CodeChef / Codeforces / GitHub, Coding points formula & leaderboards, Daily jobs (interview reminders, coding-profile refresh, rank snapshot), Director role, Company drive status question (nine options), Feedback Inbox (+18 more)

### Community 5 - "Data Models"
Cohesion: 0.06
Nodes (30): Announcement, announcementSchema, applicationSchema, assessmentSchema, attendanceSchema, auditSchema, batchSchema, codingStatSchema (+22 more)

### Community 6 - "Scoring & Intelligence"
Cohesion: 0.14
Nodes (26): attendanceCounts(), devStats(), AttendanceCounts, attendancePct(), buckets(), CATEGORIES, change(), DEFAULT_SCORING (+18 more)

### Community 7 - "Login & Password Actions"
Cohesion: 0.19
Nodes (23): changePassword(), changePasswordAtLogin(), failed(), findLogin(), login(), redeemToken(), requestReset(), setUsername() (+15 more)

### Community 8 - "Onboarding & App Shell"
Cohesion: 0.14
Nodes (17): onboardCoding(), AppLayout(), metadata, Onboarding(), Step(), Home(), KlSeal(), Sidebar() (+9 more)

### Community 9 - "Coding Leaderboards UI"
Cohesion: 0.19
Nodes (23): metadata, MyCoding(), Contests(), metadata, Leaderboard(), metadata, Chips(), FLAG (+15 more)

### Community 10 - "Account & Report Pages"
Cohesion: 0.16
Nodes (18): ActivatePage(), metadata, ReportView(), ChangePasswordPage(), metadata, FeedbackPage(), metadata, ForgotPage() (+10 more)

### Community 11 - "Dev Dependencies"
Cohesion: 0.12
Nodes (23): devDependencies, playwright-core@^1.65.0, tailwindcss@^4.3.3, @tailwindcss/postcss@^4.3.3, tsx@^4.23.15, @types/node@^22.20.5, @types/nodemailer@^8.0.2, @types/react@^19.3.0 (+15 more)

### Community 12 - "Sessions & Access Guards"
Cohesion: 0.16
Nodes (19): logout(), cookieOptions(), endSession(), b64(), COOKIE, COOKIE_DEV, cookieName(), enc (+11 more)

### Community 13 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 14 - "Settings, Formula & Reports"
Cohesion: 0.14
Nodes (13): metadata, fmt(), Formula(), PLATFORM_KEYS, APP_STATUSES, DRIVE_OPTIONS, Def, Report (+5 more)

### Community 15 - "End-to-End Tests"
Cohesion: 0.12
Nodes (6): dialog(), env, open(), SA, server, tmp

### Community 16 - "Login Form & Mail"
Cohesion: 0.23
Nodes (13): LoginForm(), LoginPage(), metadata, appUrl(), esc(), g, linkEmail(), mailEnabled() (+5 more)

### Community 17 - "Coding Profile Sync"
Cohesion: 0.19
Nodes (13): GET(), maxDuration, FETCH, fetchGithub(), get(), GH, platformPoints(), Repo (+5 more)

### Community 18 - "Database & Health"
Cohesion: 0.17
Nodes (10): dynamic, GET(), g, AuditLog, mongoose, docs, errors, rows (+2 more)

### Community 19 - "Navigation & RBAC"
Cohesion: 0.15
Nodes (11): ADMIN, Item, Nav(), NavLink(), STUDENT, ACCOUNT_TYPES, Action, ACTIONS (+3 more)

### Community 20 - "Report & Template Routes"
Cohesion: 0.26
Nodes (10): GET(), COLUMNS, GET(), SAMPLE, metadata, ReportsPage(), currentUser, canReport() (+2 more)

### Community 21 - "Runtime Dependencies"
Cohesion: 0.17
Nodes (12): dependencies, lucide-react@^1.47.0, mongoose@^9.10.1, next@^16.4.6, nodemailer@^10.5.0, react@^19.3.0, react-dom@^19.3.0, recharts@^3.10.1 (+4 more)

### Community 22 - "Root Layout & Theme"
Cohesion: 0.24
Nodes (7): inter, metadata, RootLayout(), sora, viewport, themeScript, Toaster()

### Community 23 - "Student Self-Registration"
Cohesion: 0.36
Nodes (7): checkRegistration(), mask(), registerStudent(), metadata, RegisterPage(), Found, RegisterSteps()

### Community 24 - "npm Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, seed, start, test, test:e2e, typecheck

### Community 25 - "Engines & Overrides"
Cohesion: 0.33
Nodes (4): engines, node, overrides, uuid

### Community 26 - "Vercel Config"
Cohesion: 0.50
Nodes (3): crons, framework, regions

## Knowledge Gaps
- **19 isolated node(s):** `RFC-4180`, `Top Notch Marquee Training Programme`, `Koneru Lakshmaiah Education Foundation (KL University)`, `Vercel hosting (marq.klef.me)`, `MongoDB Atlas (marq_prod)` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 234 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Onboarding & App Shell` to `Staff Pages`, `Admin & Training Actions`, `Student & Placement Pages`, `Daily Register & Import`, `Login & Password Actions`, `Account & Report Pages`, `Dev Dependencies`, `Sessions & Access Guards`, `Login Form & Mail`, `Navigation & RBAC`, `Report & Template Routes`, `Runtime Dependencies`, `Root Layout & Theme`, `Student Self-Registration`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `RFC-4180`, `Top Notch Marquee Training Programme`, `Koneru Lakshmaiah Education Foundation (KL University)` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Staff Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.09362944427067042 - nodes in this community are weakly interconnected._
- **Why does `mongoose` connect `Database & Health` to `Staff Pages`, `Admin & Training Actions`, `Student & Placement Pages`, `Daily Register & Import`, `Data Models`, `Scoring & Intelligence`, `Login & Password Actions`, `Onboarding & App Shell`, `Coding Leaderboards UI`, `Dev Dependencies`, `Sessions & Access Guards`, `Settings, Formula & Reports`, `End-to-End Tests`, `Login Form & Mail`, `Coding Profile Sync`, `Runtime Dependencies`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `Admin & Training Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.09715142428785607 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Staff Pages` to `Student & Placement Pages`, `Daily Register & Import`, `Onboarding & App Shell`, `Coding Leaderboards UI`, `Dev Dependencies`, `Navigation & RBAC`, `Report & Template Routes`, `Runtime Dependencies`, `Root Layout & Theme`, `Student Self-Registration`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Student & Placement Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05895691609977324 - nodes in this community are weakly interconnected._