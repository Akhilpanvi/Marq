# MARQ — Phase 1 discovery

## A. KLOOP technical assessment

**Repository check.** `github.com/satish5813/students_8lp` is **not** the KLOOP application. It is the earlier Python pipeline (pandas + requests) that scrapes LeetCode/CodeChef/GitHub and bakes a static `index.html` (deployed at students-8lp.vercel.app). The live **kloop.klef.me** is a Next.js app whose source is in `~/Downloads/Kareers` (package name `kloop`, remote `Akhilpanvi/Kareer`). That source was inspected read-only and nothing in it was modified.

| Area | KLOOP |
|---|---|
| Architecture | Next.js 16 App Router, server actions, `proxy.ts` optimistic guard, Vercel `bom1` + daily cron |
| Language / styling | TypeScript strict; Tailwind 4 with `@theme` tokens (KL crimson ramp) and `@utility` classes |
| Data | MongoDB/Mongoose 9: `User` (embedded skills/projects, denormalised metrics), `PlatformStat`, `Setting` |
| Auth | scrypt hashes, HMAC-signed `__Host-` cookie, `sessionVersion` revocation, lockout, SMTP reset links |
| RBAC | two roles (`student`, `admin`), role checks in actions |
| Features | coding-platform sync (GitHub/LeetCode/CodeChef/Codeforces), profile strength score, public portfolio, Gemini coach, AI JD shortlisting, CSV roster upload |
| Reusable components | `Card`, `PageHeader`, `Stat`, `Badge`, `Meter`, CSV parser, form helpers |

**Reused conceptually (patterns, not code paths):** session/password/DB helpers, `useActionState`-style forms, Tailwind token approach, CSV formula-injection escaping, security headers, admin UI primitives.
**Redesigned for MARQ:** the binary student/admin model became configurable roles with module × action permissions and scopes; one `User` collection became `User` + `Student` (students exist before accounts); denormalised scores became a transparent, configurable formula computed from records.
**Improved:** append-only histories and audit log, no plaintext credentials in any file (KLOOP's seed writes a credentials CSV), per-IP rate limits, maker-checker finance approvals, dark mode.
**What MARQ needs that KLOOP lacks:** training/batches/sessions, attendance, assessment centre, mentorship, company/job/application/interview lifecycle, finance, announcements, reports, multi-role dashboards.

**Note for the KLOOP team:** KLOOP runs `next@16.3.5`, which falls in the range of critical advisory GHSA-f87g-xv8r-7p7x (fixed in 16.4.x). MARQ uses 16.4.6. KLOOP was not changed.

## B. Smart Interviews

**Status: authenticated inspection not done.** The session that built MARQ had no browser-automation tools (Claude in Chrome / built-in browser), so it could not observe the logged-in portal after manual sign-in. No credentials were requested or used. What follows comes from the public site (smartinterviews.in) only.

Public surface: Smart Coder (16–18 weeks; programming basics → DSA → DP/graphs), Coding 101, "The Hive" practice platform (hive.smartinterviews.in), Contest Leaderboard and Leaderboard, placements showcase, interview experiences, resume builder, completion certificates, campus connect.

### Gap analysis

| Category | Item |
|---|---|
| **Already in MARQ** | Batches & training sessions with topics; attendance; assessments with rankings; performance analytics; mentor evaluations; placement tracking; notifications; reports; user/role management |
| **In Smart Interviews, missing in MARQ** | Hosted coding practice and question bank; online test engine (MARQ records results from tests run elsewhere); programme-wide leaderboard and contests; completion certificates; structured curriculum modules |
| **Opportunities worth building next** | 1) Sync coding profiles (reuse KLOOP's platform adapters) into the Coding dimension. 2) Cohort leaderboard page (overall, coding, improvement). 3) Interview-experience library fed by completed interviews' feedback. 4) Certificate generation on programme completion. 5) Curriculum module tracking on top of session topics. |

Re-run this section after an authenticated walkthrough to confirm the admin-side modules (batch management, test management, user administration) and refine the list.

## C. Skills

- **Ponytail** (read in full; full intensity): applied throughout — single models file, native `<dialog>`/GET filters instead of UI libraries, no abstractions without several callers, `ponytail:` comments on deliberate ceilings (`lib/intel.ts`, `lib/scoring.ts`), dead code removed after review. Never applied to validation, security or requested features.
- **Graphify** (read in full): code-only AST graph of MARQ in `graphify-out/` (676 nodes, 3,411 edges, 25 communities, **no import cycles**). Most-connected nodes: `PageHeader`, `Card`, `Invalid`, `Badge`, `audit`, `attempt`, `can`, `requirePage`, `guard` — the UI kit plus the authorization layer. Health check flagged 1 dangling and 10 collapsed edges (extractor artefacts). Open `graphify-out/graph.html` for the interactive map.
- **/cooking** — created from the "AI Kitchen" Notion page at `~/.claude/skills/cooking/SKILL.md` (model × effort routing for dev tasks).
- **dataviz** — chart palette validated with its CVD validator in light and dark.
