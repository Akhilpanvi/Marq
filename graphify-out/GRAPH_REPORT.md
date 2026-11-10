# Graph Report - MarQ  (2026-11-11)

## Corpus Check
- Corpus is ~47,803 words - fits in a single context window. You may not need a graph.

## Summary
- 676 nodes · 3411 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Admin, finance & announcement actions
- Auth, session & guard core
- Profile & mentorship pages
- App shell & auth pages
- Admin list pages
- Applications & placement UI
- Assessments & attendance
- Data models
- Dev dependencies
- Performance intelligence pages
- TypeScript config
- Bulk student import
- Announcements & notifications
- E2E test harness
- RBAC & roles
- Scoring engine
- Reporting
- Runtime dependencies
- Intel & journey loaders
- npm scripts
- Student job board
- Loading skeletons
- Vercel config
- Node engine

## God Nodes (most connected - your core abstractions)
1. `PageHeader()` - 74 edges
2. `Card()` - 69 edges
3. `Invalid` - 66 edges
4. `Badge()` - 58 edges
5. `audit()` - 55 edges
6. `attempt()` - 55 edges
7. `can()` - 53 edges
8. `next` - 52 edges
9. `requirePage()` - 51 edges
10. `guard()` - 49 edges

## Surprising Connections (you probably didn't know these)
- `ImportWizard()` --indirect_call--> `previewImport()`  [INFERRED]
  components/students-client.tsx → app/actions/students.ts
- `ImportWizard()` --indirect_call--> `confirmImport()`  [INFERRED]
  components/students-client.tsx → app/actions/students.ts
- `BulkBar()` --indirect_call--> `bulkStudents()`  [INFERRED]
  components/students-client.tsx → app/actions/students.ts
- `AccountPage()` --calls--> `ActionForm()`  [EXTRACTED]
  app/(app)/account/page.tsx → components/form.tsx
- `AccountPage()` --calls--> `Card()`  [EXTRACTED]
  app/(app)/account/page.tsx → components/ui.tsx

## Import Cycles
- None detected.

## Communities (25 total, 3 thin omitted)

### Community 0 - "Admin, finance & announcement actions"
Cohesion: 0.11
Nodes (92): CATS, createAnnouncement(), decideFinance(), deleteAnnouncement(), deleteFinance(), saveFinance(), saveScoring(), saveStatuses() (+84 more)

### Community 1 - "Auth, session & guard core"
Cohesion: 0.06
Nodes (60): changePassword(), login(), redeemToken(), requestReset(), GET(), dynamic, GET(), GET() (+52 more)

### Community 2 - "Profile & mentorship pages"
Cohesion: 0.11
Nodes (41): AccountPage(), metadata, metadata, MyProfile(), MentorsPage(), metadata, ATT_TONE, delta() (+33 more)

### Community 3 - "App shell & auth pages"
Cohesion: 0.07
Nodes (34): logout(), ActivatePage(), metadata, AppLayout(), ReportView(), ForgotPage(), metadata, inter (+26 more)

### Community 4 - "Admin list pages"
Cohesion: 0.21
Nodes (41): ApplicationsPage(), AssessmentsPage(), metadata, AuditPage(), metadata, short(), CompaniesPage(), CompanyFields() (+33 more)

### Community 5 - "Applications & placement UI"
Cohesion: 0.14
Nodes (37): ApplicationPage(), metadata, metadata, MyApplications(), metadata, MyAssessments(), metadata, MyInterviews() (+29 more)

### Community 6 - "Assessments & attendance"
Cohesion: 0.13
Nodes (35): AssessmentPage(), AttendancePage(), C, metadata, metadata, MyAttendance(), TONE, AccountsDashboard() (+27 more)

### Community 7 - "Data models"
Cohesion: 0.07
Nodes (28): Announcement, announcementSchema, applicationSchema, assessmentSchema, attendanceSchema, AuditLog, auditSchema, batchSchema (+20 more)

### Community 8 - "Dev dependencies"
Cohesion: 0.10
Nodes (25): devDependencies, playwright-core@^1.65.0, tailwindcss@^4.3.3, @tailwindcss/postcss@^4.3.3, tsx@^4.23.15, @types/node@^22.20.5, @types/nodemailer@^8.0.2, @types/react@^19.3.0 (+17 more)

### Community 9 - "Performance intelligence pages"
Cohesion: 0.19
Nodes (16): metadata, MyPerformance(), FLAG, Flag, metadata, metadata, Formula(), ScoreTiles() (+8 more)

### Community 10 - "TypeScript config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 11 - "Bulk student import"
Cohesion: 0.17
Nodes (14): ImportRow, ImportPage(), metadata, downloadCsv(), BulkBar(), ImportWizard(), SelectAll(), Summary (+6 more)

### Community 12 - "Announcements & notifications"
Cohesion: 0.23
Nodes (13): AnnouncementsPage(), metadata, metadata, metadata, NotificationsPage(), Action, ActionButton(), ActionForm() (+5 more)

### Community 13 - "E2E test harness"
Cohesion: 0.12
Nodes (6): dialog(), env, open(), SA, server, tmp

### Community 14 - "RBAC & roles"
Cohesion: 0.16
Nodes (11): Matrix(), metadata, R, RoleForm(), ACCOUNT_TYPES, Action, ACTIONS, DEFAULT_ROLES (+3 more)

### Community 15 - "Scoring engine"
Cohesion: 0.27
Nodes (11): buckets(), change(), DEFAULT_SCORING, istDay(), mean(), Profile, profile(), slope() (+3 more)

### Community 16 - "Reporting"
Cohesion: 0.19
Nodes (9): metadata, ReportsPage(), canReport(), Def, Report, REPORTS, scopedStudents(), AssessmentResult (+1 more)

### Community 17 - "Runtime dependencies"
Cohesion: 0.15
Nodes (13): dependencies, exceljs@^4.4.0, lucide-react@^1.47.0, mongoose@^9.10.1, next@^16.4.6, nodemailer@^10.5.0, react-dom@^19.3.0, recharts@^3.10.1 (+5 more)

### Community 18 - "Intel & journey loaders"
Cohesion: 0.31
Nodes (9): attendanceCounts(), profileOf(), profiles(), resultPoints(), AttendanceCounts, ResultPoint, Attendance, Evaluation (+1 more)

### Community 19 - "npm scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, seed, start, test, test:e2e, typecheck

### Community 20 - "Student job board"
Cohesion: 0.50
Nodes (4): metadata, MyJobs(), companyOptions(), Job

### Community 21 - "Loading skeletons"
Cohesion: 0.67
Nodes (3): Loading(), PageSkeleton(), Skeleton()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-4180`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 182 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `App shell & auth pages` to `Admin, finance & announcement actions`, `Auth, session & guard core`, `Profile & mentorship pages`, `Admin list pages`, `Applications & placement UI`, `Assessments & attendance`, `Dev dependencies`, `Performance intelligence pages`, `Announcements & notifications`, `RBAC & roles`, `Reporting`, `Runtime dependencies`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **What connects `RFC-4180` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Admin, finance & announcement actions` be split into smaller, more focused modules?**
  _Cohesion score 0.10679611650485436 - nodes in this community are weakly interconnected._
- **Why does `mongoose` connect `Intel & journey loaders` to `Admin, finance & announcement actions`, `Auth, session & guard core`, `Applications & placement UI`, `Assessments & attendance`, `Data models`, `Dev dependencies`, `E2E test harness`, `Reporting`, `Runtime dependencies`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Should `Auth, session & guard core` be split into smaller, more focused modules?**
  _Cohesion score 0.05730238025271819 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Announcements & notifications` to `Profile & mentorship pages`, `App shell & auth pages`, `Admin list pages`, `Applications & placement UI`, `Assessments & attendance`, `Dev dependencies`, `Performance intelligence pages`, `Bulk student import`, `RBAC & roles`, `Reporting`, `Runtime dependencies`, `Student job board`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `Profile & mentorship pages` be split into smaller, more focused modules?**
  _Cohesion score 0.11433756805807622 - nodes in this community are weakly interconnected._