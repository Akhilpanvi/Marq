# MARQ — Development progress

_Last updated: 11 Nov 2026_

## Status by module

"Tested" means the workflow was driven end-to-end through the UI by `scripts/e2e.ts` (production build, every role), unless noted.

| # | Module | Status | Verified by |
|---|---|---|---|
| 1 | Authentication (sign-in, lockout, IP rate limit, sessions, revocation) | Done | e2e: login per role, lockout, deactivation revokes session |
| 2 | Account activation & password reset (one-time links, SMTP optional) | Done | e2e: every account activated via link; email path not exercised (no SMTP in test) |
| 3 | User management (create, edit, deactivate/reactivate, invite/reset links, last login, creation history) | Done | e2e: 8 staff accounts, escalation blocked, deactivate |
| 4 | Roles & permissions (10 built-in roles, custom roles, permission matrix, scopes) | Done | e2e: custom role created, built-in role saved |
| 5 | Student management (CRUD, filters, bulk batch/mentor/status; picture = Drive link or GitHub avatar, never stored) | Done | e2e: roster, filters, GitHub avatar shown |
| 6 | Bulk import (template, xlsx/csv, row validation, duplicates, preview, confirm, summary, failed-records download, update mode) | Done | e2e: 7-row file incl. duplicate/invalid email/unknown batch, re-import updates |
| 7 | Bulk account creation + activation tracking | Done | e2e: 4 accounts, links CSV has no passwords |
| 8 | Training (programmes, batches, trainer allocation, sessions, topics, materials, completion, session feedback) | Done | e2e: programme/batches/session; feedback form covered by build + manual |
| 9 | Attendance (P/A/L/E, student/batch/session/monthly views, corrections with reason + history) | Done | e2e: mark, correction refused without reason, history shown |
| 10 | Assessment Centre (10 categories, create/schedule, marks entry, AB, Excel import, rankings, batch comparison, history) | Done | e2e: two assessments, marks, out-of-range rejected; Excel import of marks not in e2e |
| 11 | Performance intelligence (configurable formula, dimensions, readiness, trends, flags, distribution, cohort comparison, formula explainer) | Done | unit checks + e2e asserts computed score 86 (coding profiles, GitHub, assessments, attendance — no trainer input) |
| 12 | Student 360° profile (all 15 sections + journey timeline) | Done | e2e page render; visual review |
| 13 | Mentorship (allocation, evaluations, strengths/weaknesses, recommendations, follow-ups, mentor-wise progress) | Done | e2e: mentor scope + evaluation |
| 14 | Companies & job opportunities (publish → notify students, filters) | Done | e2e |
| 15 | Job application tracker (MARQ + self-added, 14 statuses + custom, append-only timeline, duplicate prevention, dashboards) | Done | e2e: apply, duplicate blocked, status history |
| 16 | Interviews | Removed (Nov 2026) | The programme does not run interviews; drive stages (TR/HR) still come from students’ drive-status answers |
| 17 | Reports (10 reports, CSV/Excel, branded printable view, permission + scope aware) | Done | e2e: xlsx/csv/print |
| 18 | Announcements & notifications (role/batch targeting, read/unread, history) | Done | e2e: student receives job/feedback/status notifications |
| 19 | Dashboards (admin, director, accounts, assistant, mentor/trainer, student) | Done | e2e renders; visual review |
| 20 | ~~Financial records~~ | Removed (Nov 2026, not needed) | seed drops finance permissions and the Director Accounts role |
| 21 | Audit logs (append-only, filters, IP) | Done | e2e asserts 8 action types |
| 22 | Settings (weights for the 4 parts, coding/GitHub targets, thresholds, extra statuses) | Done | renders; saving scoring manual |
| 23 | Branding (MARQ logo + variants, KL assets, favicon, reports, emails, light/dark) | Done | visual review |
| 23b | Coding profiles, leaderboards, contest leaderboard, targets, coding report (from the Smart Interviews walkthrough) | Done | e2e: live Codeforces sync, both leaderboards, visibility toggle, target flags in report |
| 23c | Daily Register: college-format period attendance, Excel/CSV upload with auto-read date and marks, Verify (absentee pop-up) → Confirm & lock, change requests with Director approval, day + consolidated Excel/CSV downloads | Done | e2e: upload, verify, lock, request, approve, both downloads |
| 23d | Student self-registration (list-only emails, details confirmation, emailed link) + mandatory onboarding (coding profiles checked live, profile) | Done | e2e |
| 23e | Company drives from the programme Google Form + “Status of the candidate” question + Drive status report | Done | e2e |
| 23f | Feedback (public / auto-filled when signed in) + admin Feedback Inbox | Done | e2e |
| 23g | Staff sign-in usernames; password change from the sign-in page | Done | e2e |
| 23h | Multi-file attendance upload (date read per file; posted/future/duplicate dates refused; one Verify for all days) | Done | e2e: 3 files, 2 saved, posted day skipped |
| 23i | Student bulk import understands the Top Notch roster (Student ID NO, Parent Branch, Branch), defaults email to regno@kluniversity.in, sample file with example rows | Done | e2e |
| 24 | Deployment config (vercel.json, env, cron, health, docs) | Done | live at https://marq.klef.me; GitHub → Vercel auto-deploy |

## Pending / next

- **Smart Interviews authenticated inspection** — blocked: no browser-automation tools were connected in the build session, so the logged-in areas could not be explored. Public-site findings are in `docs/DISCOVERY.md`. Re-run discovery with Claude in Chrome connected.
- **Production deployment** to marq.klef.me (Atlas `marq_prod`, Vercel env vars, DNS record).
- Opportunities from the gap analysis (coding-profile sync, programme leaderboard, certificates, interview-experience library) — not started; see `docs/DISCOVERY.md`.

## Known issues / limitations

- **Production data steps (one-off):** run `npm run seed` against production (applies the one-time role migrations: Administrator + Admin Assistant + Placement Administrator merged into Placement Admin, Director given full access; removes finance permissions and the unused Director Accounts role), and `npx tsx scripts/seed-drives.ts` to load the 12 company drives.
- **Self-registration email** requires `marq.klef.me` verified in Resend; until then registration stops with a clear message (links are never shown on screen).

- Learning materials and application documents are stored as **links** (Drive/LMS), not file uploads — no blob storage is configured. Profile pictures are links too (Google Drive, else the GitHub avatar); the `2026-11-photos-as-links` migration removed stored images.
- Pages stream with a loading skeleton, so `notFound()` renders the 404 page with HTTP 200 (documented Next.js behaviour). No data is rendered; e2e asserts this.
- Scores are computed on read; comfortable for hundreds of students. Denormalise onto `Student` if a cohort reaches ~10k (`lib/intel.ts`).
- Confirmations use the browser's native confirm dialog.
- Vercel Hobby allows one daily cron; it re-syncs coding profiles nightly.
- KL logos are PNG; drop `kl-seal.svg` / `kl-lockup.svg` into `public/brand/` when available.

## Testing status

- `npm test` — scoring unit checks: pass.
- `npm run test:e2e` — 36 end-to-end checks across all 10 roles: pass (Next.js 16.4.6, production build).
- `npx tsc --noEmit`, `next build`: clean. `npm audit --omit=dev`: 0 vulnerabilities.

## Architectural decisions

1. **Same stack and patterns as KLOOP** (Next 16 App Router, server actions, scrypt, HMAC cookie, Mongoose), so the team maintains one style — but a separate repo, database and deployment.
2. **Permissions as `module.action` strings on Role documents**, checked on the server in every page/action/route. Scope (`all` / `assigned`) handles mentors and trainers without per-row ACLs.
3. **Student ≠ User.** Students are imported before they have accounts; a portal account links to its record (`User.student`).
4. **Append-only histories** embedded where they belong (application status, attendance corrections, mark changes) plus a global append-only `AuditLog`.
5. **No fabricated numbers:** missing data stays "—"; weights re-normalise over available dimensions, and coverage is shown.
6. **One report builder** feeds Excel, CSV and the printable view, so they never diverge.
7. **Minimal dependencies** (Ponytail): native `<dialog>`, GET-form filters, built-in CSV parser; added only Recharts (requested), exceljs (xlsx), nodemailer (optional email).
