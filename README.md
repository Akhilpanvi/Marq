# MARQ

**Marquee Achievement & Readiness Quotient** — *Beyond Training. Towards Excellence.*

Student performance intelligence and placement-readiness platform for the Top Notch Marquee Training Programme at Koneru Lakshmaiah Education Foundation (KL University). One place for a student's whole journey: enrolment → training → attendance → assessments → mentorship → applications → interviews → offers → placement.

**Production:** https://marq.klef.me · Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · MongoDB + Mongoose · Recharts · Lucide · Vercel

> Independent from KLOOP (kloop.klef.me): separate repository, database and deployment. KLOOP was used as an architectural reference only.

## Architecture

```
proxy.ts                 optimistic gate (signed cookie); every page/action re-checks the DB
app/
  login, activate, forgot-password       auth (no public sign-up; one-time links)
  (app)/overview                         role-adaptive dashboard (admin · director · assistant · mentor/trainer)
  (app)/students[/import|/[id]]          roster, bulk import, Student 360°
  (app)/users, roles                     accounts, RBAC permission matrix
  (app)/training[/sessions/[id]]         programmes, batches, sessions, materials, attendance marking
  (app)/attendance, assessments[/[id]]   reports, assessment centre, marks entry/import, rankings
  (app)/performance, mentors             performance intelligence, mentorship & evaluations
  (app)/companies, jobs, applications[/[id]], placement
  (app)/reports[/[kind]], announcements, notifications, inbox (feedback), audit, settings, account
  register, onboarding, feedback, change-password   public: self-registration, mandatory onboarding, feedback, password change
  (app)/me/*                             student portal (identity always from the session)
  actions/*.ts                           server actions — every one calls guard()/currentUser()/requireStudent()
  api/reports/[kind]                     CSV/Excel export (permission + scope + rate limit + audit)
  api/students/template[?sample=1]      import template / sample with example rows
  api/cron/coding, api/health            nightly coding-profile sync (CRON_SECRET), health check
lib/
  auth.ts        currentUser, requirePage/guard, studentScope, audit, rateLimit
  rbac.ts        modules × actions vocabulary, default roles
  scoring.ts     pure scoring maths (tested in scripts/scoring.check.ts)
  intel.ts journey.ts reports.ts sheet.ts settings.ts placement.ts …
models/index.ts  all Mongoose schemas
components/      UI kit (ui, list, form, charts, logo, …)
```

### Security model

- **Authentication:** scrypt password hashes; HMAC-signed `__Host-` HttpOnly, Secure, SameSite=Lax session cookie; every request re-loads the user and role and checks `sessionVersion` (password change, deactivation and role change revoke all sessions). Lockout after 5 failed sign-ins (15 min) plus a per-IP limiter stored in MongoDB.
- **Accounts:** no public sign-up and no passwords ever shown, exported or emailed. Admins issue one-time activation/reset links (only a SHA-256 of the token is stored; 7 days / 30 minutes). With SMTP configured they are emailed, otherwise shown once to copy.
- **Authorization:** permissions are `module.action` strings on roles, checked server-side in every page (`requirePage`), action (`guard`) and route. Roles with `assigned` scope (mentors, trainers) only reach their mentees and the batches they train. Students only ever query by the student id in their session. No privilege escalation: you can only grant roles/permissions you hold.
- **Data:** input validation at every action, file upload type/size checks, spreadsheet formula-injection escaping, append-only audit log (writes blocked at the model), security headers (HSTS, frame-deny, nosniff…).

### Scoring

Scores come from four parts, with no trainer judgement involved: **coding profiles** (LeetCode + CodeChef + Codeforces points, 100 at the target, default 20,000), **GitHub** (contributions + 10 × repos + 5 × stars, 100 at 400), **assessments** (average % of all marks) and **attendance** (% of periods). Default weights: Overall 40 / 25 / 20 / 15, Readiness 45 / 20 / 25 / 10. Missing data is shown as "—" and never counted as zero — weights re-normalise over the parts that have data. Weights, targets and thresholds are editable in **Settings**, and the live formula is shown on every performance screen.

Profile pictures are never stored: a student's Google Drive share link if they give one, otherwise their GitHub avatar, otherwise initials.

## Local development

```bash
npm install
cp .env.example .env.local      # MONGODB_URI=mongodb://127.0.0.1:27017/marq_dev, SESSION_SECRET, SUPERADMIN_*
npm run seed                    # system roles + first Super Administrator (no sample data)
npm run dev
```

Sign in as the Super Administrator, then: create staff accounts (User Management) → programme and batches (Training) → import students (Students → Bulk import). Students then self-register at `/register` (only listed emails are accepted) — see `docs/STUDENT-REGISTRATION.md` — or admins invite them from Students → **Create accounts & invite**.

Company drives from the programme's Google Form: `MONGODB_URI=… npx tsx scripts/seed-drives.ts` (idempotent).

### Tests

```bash
npm test             # scoring unit checks
npx next build && npm run test:e2e
```

`test:e2e` runs the production build on :3200 against a throwaway `marq_test` database (dropped first) and drives every role through the real UI with headless Chromium (38 checks across every role, including self-registration, onboarding, the daily register, drive status, feedback and security). Set `CHROME=/path/to/chrome` if the Playwright headless shell isn't at the default cache path.

## Deployment (Vercel)

1. **Database:** create a dedicated MongoDB Atlas database for production (e.g. `marq_prod`) — never KLOOP's. Allow Vercel's egress (or 0.0.0.0/0 with a strong password).
2. **Project:** import this repo in Vercel (framework: Next.js, Node 22). Region `bom1` is set in `vercel.json`.
3. **Environment variables** (Production, and separate values for Preview):

   | Variable | |
   | --- | --- |
   | `MONGODB_URI` | Atlas URI including the database name |
   | `SESSION_SECRET` | `openssl rand -base64 48` — different per environment |
   | `APP_URL` | `https://marq.klef.me` |
   | `CRON_SECRET` | random string; Vercel sends it to `/api/cron/reminders` |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | optional — emails invitations and resets |

4. **Seed once** from a trusted machine: `MONGODB_URI=… SUPERADMIN_EMAIL=… SUPERADMIN_PASSWORD=… npm run seed` (also syncs all indexes).
5. **Domain:** add `marq.klef.me` to the Vercel project and create the DNS record Vercel shows (CNAME `marq` → `cname.vercel-dns.com`) at the `klef.me` DNS provider. HTTPS is automatic.
6. Verify: `https://marq.klef.me/api/health` returns `{"ok":true}`; sign in; check Settings → Email.

Logs: Vercel runtime logs (server errors are logged with `console.error`). The daily cron (02:00 IST) re-syncs every linked coding profile.

## Branding

- `components/logo.tsx` — MARQ wordmark (geometric paths, one colour per letter, light/dark variants via CSS variables), `MarqMark` (the Q with its quotient slash), `MarqLockup`. Static copies: `public/marq-logo.svg`, `app/icon.svg` (favicon).
- KL University: the official `kl-seal.png` and `kl-lockup.png` supplied in `Brand/`, served from `public/brand/`; never redrawn. Replace them with SVGs when available.
- Chart palette validated for colour-vision deficiency in light and dark (`app/globals.css`).

See `PROGRESS.md` for module status and decisions, `docs/DISCOVERY.md` for the KLOOP assessment and the Smart Interviews gap analysis, `docs/STUDENT-REGISTRATION.md` for the registration flow (with screenshots and a video script), and `docs/MARQ-How-It-Works.pdf` for the illustrated overview (flowcharts and mind maps).
