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

### Observed after login (from a screenshot of a student profile page, 11 Nov 2026)

`/profile/<username>` shows:
- **Identity card** with a public/private visibility toggle, an **Overall Score** (practice-based points) and a **Global Rank** across all Smart Interviews users.
- **Global Rankings chart**: the student's rank over time (inverted axis). Rank moves daily, and a sharp drop shows when the global pool changes.
- **Recent Education** (degree and institution).
- **CodeChef Ratings**: current rating, highest rating, total contests and last rating change, with a small rating-history chart. These are pulled from the external platform.
- **Score Distribution**: a sunburst chart breaking the score down by topic and difficulty.

Implication for MARQ: MARQ ranks students per assessment, but it has no **cohort rank that changes over time**, no **practice-points score**, no **external coding-platform ratings**, and no **topic × difficulty breakdown**. These become items 1–3 in the opportunities below.

### Gap analysis

| Category | Item |
|---|---|
| **Already in MARQ** | Batches & training sessions with topics; attendance; assessments with rankings; performance analytics; mentor evaluations; placement tracking; notifications; reports; user/role management |
| **In Smart Interviews, missing in MARQ** | Hosted coding practice and question bank; online test engine (MARQ records results from tests run elsewhere); programme-wide leaderboard and contests; completion certificates; structured curriculum modules |
| **Opportunities worth building next** | 1) Sync external coding profiles (CodeChef/LeetCode/Codeforces ratings and history, reusing KLOOP's adapters) into the Coding dimension and the Student 360. 2) Cohort leaderboard with **rank history over time** (overall, coding, improvement), shown on each student's dashboard. 3) Topic × difficulty breakdown of assessment performance (sunburst or heatmap). 4) Interview-experience library fed by completed interviews' feedback. 5) Certificates on programme completion. 6) Curriculum module tracking on top of session topics. |

Re-run this section after an authenticated walkthrough to confirm the admin-side modules (batch management, test management, user administration) and refine the list.

## C. Skills

- **Ponytail** (read in full; full intensity): applied throughout — single models file, native `<dialog>`/GET filters instead of UI libraries, no abstractions without several callers, `ponytail:` comments on deliberate ceilings (`lib/intel.ts`, `lib/scoring.ts`), dead code removed after review. Never applied to validation, security or requested features.
- **Graphify** (read in full): code-only AST graph of MARQ in `graphify-out/` (676 nodes, 3,411 edges, 25 communities, **no import cycles**). Most-connected nodes: `PageHeader`, `Card`, `Invalid`, `Badge`, `audit`, `attempt`, `can`, `requirePage`, `guard` — the UI kit plus the authorization layer. Health check flagged 1 dangling and 10 collapsed edges (extractor artefacts). Open `graphify-out/graph.html` for the interactive map.
- **/cooking** — created from the "AI Kitchen" Notion page at `~/.claude/skills/cooking/SKILL.md` (model × effort routing for dev tasks).
- **dataviz** — chart palette validated with its CVD validator in light and dark.
