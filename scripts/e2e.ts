// End-to-end test of every role through the real UI, against a throwaway database.
//   npm run test:e2e        (builds nothing; expects `next build` to have run)
// Starts `next start` on :3200 with MONGODB_URI=…/marq_test, drops that DB first, and never touches marq_dev.
import assert from 'node:assert/strict'
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import mongoose from 'mongoose'
import { chromium, type Page } from 'playwright-core'

const PORT = 3200
const BASE = `http://localhost:${PORT}`
const DB = 'mongodb://127.0.0.1:27017/marq_test'
const PW = 'Correct-Horse-42'
const SA = { email: 'sa@marq.test', pw: 'Super-Admin-Pass-1' }
const tmp = mkdtempSync(join(tmpdir(), 'marq-e2e-'))
const env = { ...process.env, MONGODB_URI: DB, APP_URL: BASE, NODE_ENV: 'production', PORT: String(PORT), SUPERADMIN_EMAIL: SA.email, SUPERADMIN_PASSWORD: SA.pw, SMTP_HOST: '', CRON_SECRET: 'test-cron', REGISTRATION_SHOW_LINK: 'true', LOGIN_RATE_LIMIT: '500' } as NodeJS.ProcessEnv
const chrome = process.env.CHROME ?? join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell')

let passed = 0
async function step(name: string, fn: () => Promise<void>) {
  process.stdout.write(`• ${name} … `)
  await fn()
  passed++
  console.log('ok')
}

await mongoose.connect(DB)
await mongoose.connection.dropDatabase()
execSync('npx tsx scripts/seed.ts', { env, stdio: 'ignore' })
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = ''
server.stdout.on('data', d => (serverLog += d))
server.stderr.on('data', d => (serverLog += d))
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${BASE}/api/health`)).ok) break } catch {}
  await new Promise(r => setTimeout(r, 500))
}
const browser = await chromium.launch({ executablePath: chrome })

async function login(email: string, pw = PW) {
  const ctx = await browser.newContext({ baseURL: BASE, acceptDownloads: true })
  const p = await ctx.newPage()
  await p.goto('/login')
  await p.fill('input[name=id]', email)
  await p.fill('input[name=password]', pw)
  await p.click('button:has-text("Sign in")')
  await p.waitForURL(u => !u.pathname.startsWith('/login'))
  return p
}
const dialog = (p: Page) => p.locator('dialog[open]')
async function open(p: Page, label: string | RegExp) {
  await p.getByRole('button', { name: label }).first().click()
  await dialog(p).waitFor()
  return dialog(p)
}
const toast = (p: Page, text: string | RegExp) => p.locator('[aria-live=polite]').getByText(text).first().waitFor({ timeout: 10_000 })
const errorShown = (p: Page, text: string | RegExp) => p.getByRole('alert').filter({ hasText: text }).first().waitFor({ timeout: 10_000 })

/** Streaming pages answer 200 even for notFound(); what matters is the not-found UI and no leaked data. */
async function blocked(p: Page, path: string, secret: string) {
  const r = await p.goto(path)
  const html = await p.content()
  assert.ok(r?.status() === 404 || /Page not found/.test(html), `${path} should be not found`)
  assert.ok(!html.includes(secret), `${path} leaked ${secret}`)
}

async function activate(link: string, pw = PW) {
  const ctx = await browser.newContext({ baseURL: BASE })
  const p = await ctx.newPage()
  await p.goto(link)
  await p.fill('input[name=next]', pw)
  await p.fill('input[name=confirm]', pw)
  await p.click('button:has-text("Set password")')
  await p.waitForURL(u => u.pathname === '/overview' || u.pathname === '/me')
  await ctx.close()
}

try {
  const sa = await login(SA.email, SA.pw)
  const staff: Record<string, string> = {
    'Admin Assistant': 'aa@marq.test', 'Training Administrator': 'ta@marq.test', 'Placement Administrator': 'pa@marq.test',
    Mentor: 'm1@marq.test', Trainer: 't1@marq.test', Director: 'dir@marq.test', Administrator: 'admin@marq.test',
  }

  await step('Super Admin creates one account per role and each activates via one-time link', async () => {
    // Administrator, Admin Assistant and Placement Administrator are now one role: Placement Admin
    const ROLE: Record<string, string> = { 'Admin Assistant': 'Placement Admin', 'Placement Administrator': 'Placement Admin', Administrator: 'Placement Admin' }
    for (const [label, email] of Object.entries(staff)) {
      const role = ROLE[label] ?? label
      await sa.goto('/users')
      const d = await open(sa, /New account/)
      await d.locator('input[name=name]').fill(`${label} User`)
      await d.locator('input[name=email]').fill(email)
      await d.locator('select[name=type]').selectOption(role === 'Mentor' ? 'mentor' : role === 'Trainer' ? 'trainer' : 'administrative')
      await d.locator('select[name=role]').selectOption({ label: role })
      await d.getByRole('button', { name: 'Create & invite' }).click()
      const link = await d.locator('input[readonly]').inputValue()
      assert.match(link, /\/activate\?token=/)
      await activate(link)
    }
    await sa.goto('/users')
    await sa.getByText('m1@marq.test').waitFor()
  })

  const ta = await login(staff['Training Administrator'])
  await step('Training Admin creates programme and two batches (trainer on Batch A)', async () => {
    await ta.goto('/training')
    let d = await open(ta, 'New programme')
    await d.locator('input[name=name]').fill('Top Notch Marquee 2026')
    await d.getByRole('button', { name: 'Create programme' }).click()
    await toast(ta, 'Programme saved')
    for (const [name, trainer] of [['Batch A', true], ['Batch B', false]] as const) {
      await ta.goto('/training')
      d = await open(ta, 'New batch')
      await d.locator('select[name=program]').selectOption({ label: 'Top Notch Marquee 2026' })
      await d.locator('input[name=name]').fill(name)
      if (trainer) await d.locator('select[name=trainers]').selectOption({ label: 'Trainer User' })
      await d.getByRole('button', { name: 'Create batch' }).click()
      await toast(ta, 'Batch saved')
    }
  })

  const aa = await login(staff['Admin Assistant'])
  const csv = join(tmp, 'students.csv')
  writeFileSync(csv, [
    'Registration Number,Full Name,University Email,Department,Batch,Mentor Email,Mobile Number',
    '2300030001,Asha Rao,2300030001@kluniversity.in,CSE,Batch A,m1@marq.test,9876543210',
    '2300030002,Bharat Kumar,2300030002@kluniversity.in,CSE,Batch A,,9876543211',
    '2300030003,Chitra Devi,2300030003@kluniversity.in,ECE,Batch B,m1@marq.test,',
    '2300030004,Dev Patel,2300030004@kluniversity.in,ECE,Batch B,,',
    '2300030001,Asha Duplicate,dup@kluniversity.in,CSE,,,',
    '2300030005,Bad Email,not-an-email,CSE,,,',
    '2300030006,Bad Batch,2300030006@kluniversity.in,CSE,Batch Z,,',
  ].join('\n'))

  await step('Admin Assistant imports students: preview flags duplicate, invalid email and unknown batch; confirm imports 4', async () => {
    await aa.goto('/students/import')
    await aa.setInputFiles('input[type=file]', csv)
    await aa.getByRole('button', { name: /Validate/ }).click()
    await aa.getByText('Duplicate registration number in this file').waitFor()
    await aa.getByText('University email is invalid').waitFor()
    await aa.getByText('Batch "Batch Z" does not exist').waitFor()
    const dl = aa.waitForEvent('download')
    await aa.getByRole('button', { name: 'Failed records' }).click()
    const failed = readFileSync(await (await dl).path(), 'utf8')
    assert.match(failed, /Batch ""Batch Z"" does not exist/)
    assert.doesNotMatch(failed, /password/i)
    await aa.getByRole('button', { name: /Confirm import \(4\)/ }).click()
    await toast(aa, 'Import complete: 4 added, 0 updated')
    await aa.goto('/students')
    for (const n of ['Asha Rao', 'Bharat Kumar', 'Chitra Devi', 'Dev Patel']) await aa.getByText(n).first().waitFor()
  })

  await step('Re-import with "update existing" updates instead of duplicating', async () => {
    await aa.goto('/students/import')
    await aa.setInputFiles('input[type=file]', csv)
    await aa.getByLabel(/Update existing students/).check()
    await aa.getByRole('button', { name: /Validate/ }).click()
    await aa.getByRole('button', { name: /Confirm import \(4\)/ }).click()
    await toast(aa, 'Import complete: 0 added, 4 updated')
    assert.equal(await mongoose.connection.collection('students').countDocuments(), 4)
  })

  const studentLinks = new Map<string, string>()
  await step('Admin Assistant creates student accounts in bulk; activation links download (no passwords)', async () => {
    await aa.goto('/students')
    await aa.getByLabel('Select all').check()
    await aa.getByRole('button', { name: /Create accounts/ }).click()
    await toast(aa, /Created 4 accounts/)
    const dl = aa.waitForEvent('download')
    await aa.getByRole('button', { name: /Activation links/ }).click()
    const text = readFileSync(await (await dl).path(), 'utf8')
    assert.doesNotMatch(text, /password/i)
    for (const line of text.split('\n').slice(1)) {
      const [reg, , link] = line.split(',').map(c => c.replace(/^"|"\r?$/g, '').replace(/"$/, ''))
      studentLinks.set(reg, link)
    }
    assert.equal(studentLinks.size, 4)
    for (const reg of ['2300030001', '2300030002', '2300030003']) await activate(studentLinks.get(reg)!)
  })

  await step('Admin Assistant cannot escalate: assigning Super Administrator is refused', async () => {
    await aa.goto('/users')
    const d = await open(aa, /New account/)
    await d.locator('input[name=name]').fill('Sneaky')
    await d.locator('input[name=email]').fill('sneaky@marq.test')
    assert.equal(await d.locator('select[name=role] option', { hasText: 'Super Administrator' }).count(), 1)
    await d.locator('select[name=role]').selectOption({ label: 'Super Administrator' })
    await d.getByRole('button', { name: 'Create & invite' }).click()
    await errorShown(aa, /cannot assign the Super Administrator role/)
  })

  const ids = Object.fromEntries((await mongoose.connection.collection('students').find().toArray()).map(s => [s.regNo, String(s._id)]))

  await step('Training Admin schedules a session and marks attendance; correction requires a reason and keeps history', async () => {
    await ta.goto('/training')
    const d = await open(ta, /Schedule session/)
    await d.locator('input[name=title]').fill('Arrays & Hashing')
    await d.locator('select[name=batch]').selectOption({ label: 'Batch A' })
    await d.locator('input[name=date]').fill(new Date(Date.now() - 86400_000).toISOString().slice(0, 10))
    await d.locator('input[name=topics]').fill('arrays, hashing')
    await d.getByRole('button', { name: 'Schedule' }).click()
    await toast(ta, 'Session saved')
    await ta.goto('/training')
    await ta.getByRole('link', { name: 'Arrays & Hashing' }).click()
    await ta.getByLabel('Asha Rao present').check()
    await ta.getByLabel('Bharat Kumar absent').check()
    await ta.getByRole('button', { name: 'Save attendance' }).click()
    await toast(ta, 'Saved: 2 marked')
    await ta.getByLabel('Bharat Kumar late').check()
    await ta.getByRole('button', { name: 'Save attendance' }).click()
    await errorShown(ta, 'Enter a reason for the correction')
    await ta.fill('input[name=reason]', 'Arrived after roll call, verified by trainer')
    await ta.getByRole('button', { name: 'Save attendance' }).click()
    await toast(ta, '1 corrected')
    await ta.reload()
    await ta.getByText('absent→late: Arrived after roll call').waitFor()
  })

  await step('Training Admin creates assessments and enters marks (AB = absent); ranking shown', async () => {
    for (const [name, cat, max, batch] of [['Coding Test 1', 'Coding', '50', 'Batch A'], ['Aptitude 1', 'Aptitude', '100', '']] as const) {
      await ta.goto('/assessments')
      const d = await open(ta, /New assessment/)
      await d.locator('input[name=name]').fill(name)
      await d.locator('select[name=category]').selectOption(cat)
      await d.locator('input[name=maxMarks]').fill(max)
      await d.locator('input[name=date]').fill(new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10))
      if (batch) await d.locator('select[name=batches]').selectOption({ label: batch })
      await d.getByRole('button', { name: 'Create' }).click()
      await toast(ta, 'Assessment saved')
    }
    await ta.goto('/assessments')
    await ta.getByRole('link', { name: 'Coding Test 1' }).click()
    await ta.getByLabel('Marks for Asha Rao', { exact: true }).fill('40')
    await ta.getByLabel('Marks for Bharat Kumar', { exact: true }).fill('AB')
    await ta.getByRole('button', { name: 'Save marks' }).click()
    await toast(ta, 'Saved 2 results')
    await ta.getByLabel('Marks for Asha Rao', { exact: true }).fill('60')
    await ta.getByRole('button', { name: 'Save marks' }).click()
    await errorShown(ta, 'Marks must be between 0 and 50')
    await ta.goto('/assessments')
    await ta.getByRole('link', { name: 'Aptitude 1' }).click()
    for (const [n, v] of [['Asha Rao', '70'], ['Bharat Kumar', '55'], ['Chitra Devi', '80'], ['Dev Patel', '30']]) await ta.getByLabel(`Marks for ${n}`, { exact: true }).fill(v)
    await ta.getByRole('button', { name: 'Save marks' }).click()
    await toast(ta, 'Saved 4 results')
  })

  await step('Scores are computed from real data only (Asha: assessments 80 & 70, attendance 100, no coding profiles yet)', async () => {
    await ta.goto(`/performance`)
    const row = ta.locator('tr', { hasText: 'Asha Rao' })
    // assessments = 75, attendance = 100; coding/GitHub not linked → weights re-normalise: (75*20 + 100*15) / 35 = 85.7 → 86
    await row.getByText('86', { exact: true }).first().waitFor()
    await ta.goto(`/students/${ids['2300030004']}`)
    await ta.getByText('Link coding profiles').first().waitFor() // no coding data → "—" with a hint, not 0
  })

  await step('Trainer sees only their batch; other students 404 even by URL', async () => {
    const t1 = await login(staff.Trainer)
    await t1.goto('/students')
    await t1.getByText('Asha Rao').waitFor()
    assert.equal(await t1.getByText('Chitra Devi').count(), 0)
    await blocked(t1, `/students/${ids['2300030003']}`, 'Chitra')
    await t1.goto('/users')
    await t1.waitForURL('**/denied')
    await t1.context().close()
  })

  await step('Mentor sees only mentees, adds an evaluation; non-mentee 404', async () => {
    const m1 = await login(staff.Mentor)
    await m1.goto('/students')
    await m1.getByText('Asha Rao').waitFor()
    await m1.getByText('Chitra Devi').waitFor()
    assert.equal(await m1.getByText('Bharat Kumar').count(), 0)
    await blocked(m1, `/students/${ids['2300030002']}`, 'Bharat')
    await m1.goto(`/students/${ids['2300030001']}`)
    const d = await open(m1, /Add evaluation/)
    await d.locator('select[name=coding]').selectOption('4')
    await d.locator('textarea[name=strengths]').fill('Strong problem decomposition')
    await d.locator('textarea[name=recommendations]').fill('Practise graph problems weekly')
    await d.getByRole('button', { name: 'Save evaluation' }).click()
    await toast(m1, 'Evaluation saved')
    await m1.reload()
    await m1.getByText('Strong problem decomposition').first().waitFor()
    await m1.context().close()
  })

  const pa = await login(staff['Placement Administrator'])
  await step('Placement Admin adds a company and publishes an opportunity', async () => {
    await pa.goto('/companies')
    let d = await open(pa, /Add company/)
    await d.locator('input[name=name]').fill('Acme Corp')
    await d.locator('input[name=industry]').fill('Software')
    await d.getByRole('button', { name: 'Add company' }).click()
    await toast(pa, 'Company saved')
    await pa.goto('/jobs')
    d = await open(pa, /Publish opportunity/)
    await d.locator('select[name=company]').selectOption({ label: 'Acme Corp' })
    await d.locator('input[name=role]').fill('Software Engineer')
    await d.locator('input[name=ctc]').fill('12')
    await d.locator('input[name=deadline]').fill(new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10))
    await d.locator('input[name=skills]').fill('Java, DSA')
    await d.getByRole('button', { name: 'Save' }).click()
    await toast(pa, 'Opportunity saved')
  })

  const s1 = await login('2300030001@kluniversity.in')
  await step('New student must complete onboarding: coding profiles (checked live) then profile', async () => {
    await s1.waitForURL('**/onboarding')
    await s1.goto('/me') // gated
    await s1.waitForURL('**/onboarding')
    await s1.fill('input[name=leetcode]', 'lee215')
    await s1.fill('input[name=codechef]', 'this-user-does-not-exist-zz9')
    await s1.fill('input[name=github]', 'torvalds')
    await s1.getByRole('button', { name: 'Verify & continue' }).click()
    await errorShown(s1, /don’t exist: codechef/)
    await s1.fill('input[name=codechef]', 'gennady.korotkevich')
    await s1.getByRole('button', { name: 'Verify & continue' }).click()
    await toast(s1, 'Coding profiles verified')
    await s1.reload()
    await s1.fill('input[name=phone]', '9876543210')
    await s1.fill('input[name=personalEmail]', 'asha.personal@example.com')
    await s1.fill('input[name=headline]', 'Aspiring backend engineer')
    await s1.fill('input[name=linkedin]', 'https://linkedin.com/in/example')
    await s1.fill('input[name=resume]', 'https://drive.google.com/file/d/example')
    await s1.fill('input[name=skills]', 'Java, DSA')
    await s1.getByRole('button', { name: 'Finish & open MARQ' }).click()
    await errorShown(s1, /at least 3 skills/)
    await s1.fill('input[name=skills]', 'Java, DSA, SQL')
    await s1.getByRole('button', { name: 'Finish & open MARQ' }).click()
    await s1.waitForURL('**/me')
  })

  await step('Student: dashboard, notifications, answers "Did you apply?" on a drive, duplicate blocked', async () => {
    await s1.goto('/me')
    await s1.getByText('Welcome, Asha').waitFor()
    await s1.goto('/notifications')
    await s1.getByText('New opportunity: Acme Corp').waitFor()
    await s1.getByText('New mentor feedback').waitFor()
    await s1.goto('/me/jobs')
    await s1.getByText('still need your status').waitFor()
    await s1.locator('.card', { hasText: 'Software Engineer' }).getByRole('button', { name: 'Yes, I applied' }).click()
    await toast(s1, /Saved: Applied but no response/)
    await s1.getByText('Applied — waiting to hear back').waitFor()
    await s1.goto('/me/applications')
    const d = await open(s1, /Add application/)
    await d.locator('input[name=company]').fill('acme corp')
    await d.locator('input[name=role]').fill('software engineer')
    await d.getByRole('button', { name: 'Save application' }).click()
    await errorShown(s1, 'already exists')
  })

  await step('Student: self-added application with status history (nothing overwritten)', async () => {
    await s1.goto('/me/applications')
    const d = await open(s1, /Add application/)
    await d.locator('input[name=company]').fill('Globex')
    await d.locator('input[name=role]').fill('Data Analyst')
    await d.locator('input[name=source]').fill('LinkedIn')
    await d.getByRole('button', { name: 'Save application' }).click()
    await toast(s1, 'Application saved')
    await s1.goto('/me/applications')
    await s1.getByRole('link', { name: /Globex/ }).click()
    await s1.getByLabel('New status').selectOption('Written Test Scheduled')
    await s1.getByPlaceholder('Remarks (optional)').fill('Test on Friday')
    await s1.getByRole('button', { name: 'Update' }).click()
    await toast(s1, 'Status updated to Written Test Scheduled')
    await s1.reload()
    await s1.getByText('Test on Friday').waitFor()
    const app = await mongoose.connection.collection('applications').findOne({ company: 'Globex' })
    assert.deepEqual(app!.history.map((h: { to: string }) => h.to), ['Applied', 'Written Test Scheduled'])
  })

  await step('Drive status: student answers the form question on a drive; report counts it', async () => {
    await s1.goto('/me/jobs') // she already applied to the only drive, so no reminder banner
    const card = s1.locator('.card', { hasText: 'Software Engineer' })
    await card.getByRole('button', { name: 'Technical round' }).click()
    await toast(s1, /Saved: Qualified for Technical Interview Round/)
    await card.getByRole('button', { name: 'No, not selected' }).click()
    await toast(s1, /Saved: Rejected in Technical Interview Round/)
    await card.getByText('Not selected in the technical round').waitFor()
    await card.getByRole('button', { name: 'Yes, still in' }).click()
    await card.getByText('Cleared the online test — in the technical round').waitFor()
    const app = await mongoose.connection.collection('applications').findOne({ company: 'Acme Corp' })
    assert.equal(app!.status, 'Technical Interview Scheduled')
    const csv = await (await sa.request.get('/api/reports/drives?format=csv')).text()
    assert.match(csv, /"Acme Corp","Software Engineer","Open","1","3"/)
  })

  await step('Coding profiles: student links a handle, gets points, rank and appears on both leaderboards', async () => {
    await s1.goto('/me/coding')
    await s1.fill('input[name=codeforces]', 'bad handle!')
    await s1.getByRole('button', { name: 'Save & sync' }).click()
    await errorShown(s1, "characters usernames can't contain")
    await s1.fill('input[name=codeforces]', 'tourist') // live public APIs
    await s1.fill('input[name=github]', 'torvalds')
    await s1.getByRole('button', { name: 'Save & sync' }).click()
    await toast(s1, 'Coding profiles saved and synced')
    await s1.reload()
    await s1.getByText('Current rating').first().waitFor()
    await s1.getByText('Public repos').waitFor()
    assert.doesNotMatch(await s1.locator('main').innerText(), /Coding points\s*0\b/)
    await s1.goto('/me/leaderboard')
    await s1.getByText('(you)').first().waitFor()
    await s1.goto('/me/contests?platform=codeforces')
    await s1.getByText('(you)').first().waitFor()
    await s1.getByRole('button', { name: 'Sync now' }).count() // present only when linked
    await s1.goto('/me')
    await s1.locator('img[src^="https://github.com/torvalds.png"]').first().waitFor({ state: 'attached' }) // GitHub picture, nothing stored
  })

  await step('Professional details save; hiding from leaderboard removes the student', async () => {
    await s1.goto('/me/profile')
    await s1.fill('input[name=headline]', 'Backend developer in training')
    await s1.fill('input[name=github]', 'https://github.com/example')
    await s1.getByLabel(/Show me on the cohort leaderboards/).uncheck()
    await s1.locator('form', { hasText: 'Headline' }).getByRole('button', { name: 'Save' }).click()
    await toast(s1, 'Professional details saved')
    await s1.goto('/me/leaderboard')
    assert.equal(await s1.getByText('(you)').count(), 0)
    await s1.goto('/me/profile')
    await s1.getByLabel(/Show me on the cohort leaderboards/).check()
    await s1.locator('form', { hasText: 'Headline' }).getByRole('button', { name: 'Save' }).click()
    await toast(s1, 'Professional details saved')
  })

  await step('Targets: trainer admin sets a batch target; coding report flags students', async () => {
    await ta.goto('/training')
    const d = await open(ta, 'Add target')
    await d.locator('select[name=batch]').selectOption({ label: 'Batch A' })
    await d.locator('input[name=name]').fill('Target-1')
    await d.locator('input[name=due]').fill(new Date(Date.now() - 86400_000).toISOString().slice(0, 10))
    await d.locator('input[name=points]').fill('100')
    await d.getByRole('button', { name: 'Add target' }).click()
    await toast(ta, 'Target added')
    const csv = await (await ta.request.get('/api/reports/coding?format=csv')).text()
    assert.match(csv, /Asha Rao.*Target-1 \(100\).*Met/)
    assert.match(csv, /Bharat Kumar.*Improve immediately/)
  })

  await step('Student isolation: admin pages denied, other student data 403/404 by URL and API', async () => {
    await s1.goto('/students')
    await s1.waitForURL('**/denied')
    await s1.goto(`/students/${ids['2300030003']}`)
    await s1.waitForURL('**/denied')
    assert.doesNotMatch(await s1.content(), /Chitra/)
    assert.equal((await s1.request.get('/api/reports/students?format=csv')).status(), 403)
    await s1.goto('/me/assessments')
    await s1.getByText('Coding Test 1').waitFor()
    const html = await s1.content()
    assert.doesNotMatch(html, /Chitra|Bharat|Dev Patel/)
  })

  await step('Placement Admin moves the application to Offered; student is notified; timeline grows', async () => {
    await pa.goto('/applications')
    await pa.getByRole('link', { name: 'Acme Corp' }).click()
    await pa.getByLabel('New status').selectOption('Offered')
    await pa.getByRole('button', { name: 'Update' }).click()
    await toast(pa, 'Status updated to Offered')
    await s1.goto('/notifications')
    await s1.getByText('Acme Corp: Offered').waitFor()
    await pa.goto('/placement')
    await pa.getByText('Students with offers').waitFor()
  })

  await step('Director: executive overview with full access to every module', async () => {
    const dir = await login(staff.Director)
    await dir.getByRole('heading', { name: 'Executive Overview' }).waitFor()
    await dir.goto('/students')
    await dir.getByRole('button', { name: /Add student/ }).waitFor()
    for (const path of ['/users', '/audit', '/roles', '/settings', '/inbox']) {
      const r = await dir.goto(path)
      assert.equal(r?.status(), 200, path)
      assert.ok(!dir.url().endsWith('/denied'), path)
    }
    assert.equal((await dir.request.get('/api/reports/performance?format=xlsx')).status(), 200)
    await dir.context().close()
  })

  await step('Feedback: visitor and signed-in student; admins see it in the inbox', async () => {
    const ctx = await browser.newContext({ baseURL: BASE })
    const v = await ctx.newPage()
    await v.goto('/login')
    await v.getByRole('link', { name: 'Send feedback' }).click()
    await v.fill('input[name=name]', 'A Visitor')
    await v.fill('input[name=email]', 'visitor@example.com')
    await v.fill('textarea[name=message]', 'The login page looks great on my phone.')
    await v.getByRole('button', { name: 'Send feedback' }).click()
    await toast(v, /feedback has been sent/)
    await ctx.close()
    await s1.goto('/feedback')
    await s1.getByText('Sending as').waitFor()
    assert.equal(await s1.locator('input[name=email]').count(), 0)
    await s1.locator('select[name=category]').selectOption('Bug')
    await s1.fill('textarea[name=message]', 'Leaderboard should show my batch first.')
    await s1.getByRole('button', { name: 'Send feedback' }).click()
    await toast(s1, /feedback has been sent/)
    await sa.goto('/inbox')
    await sa.getByText('The login page looks great on my phone.').waitFor()
    await sa.getByText(/Student · 2300030001/).waitFor()
    await sa.getByRole('button', { name: 'Mark resolved' }).first().click()
    await toast(sa, 'Marked resolved')
    await s1.goto('/inbox')
    await s1.waitForURL('**/denied')
  })

  await step('Student self-registration: only Top Notch emails, details shown, link emailed, then onboarding', async () => {
    const ctx = await browser.newContext({ baseURL: BASE })
    const p = await ctx.newPage()
    await p.goto('/register')
    await p.fill('input[type=email]', 'stranger@gmail.com')
    await p.getByRole('button', { name: 'Continue' }).click()
    await errorShown(p, /not on the Top Notch Marquee list/)
    await p.fill('input[type=email]', '2300030001@kluniversity.in')
    await p.getByRole('button', { name: 'Continue' }).click()
    await errorShown(p, /already registered/)
    await p.fill('input[type=email]', '2300030004@kluniversity.in')
    await p.getByRole('button', { name: 'Continue' }).click()
    await p.getByText('Is this you?').waitFor()
    await p.getByText('Dev Patel').waitFor()
    await p.getByRole('button', { name: 'Register' }).click()
    await p.getByText(/test mode: link shown/).waitFor()
    const link = await p.locator('a[href*="/activate?token="]').getAttribute('href')
    await p.goto(link!)
    await p.fill('input[name=next]', PW)
    await p.fill('input[name=confirm]', PW)
    await p.click('button:has-text("Set password")')
    await p.waitForURL('**/onboarding')
    await p.getByText('Coding profiles').first().waitFor()
    await ctx.close()
  })

  await step('Staff username sign-in and password change from the login page', async () => {
    const ad = await login(staff['Placement Administrator'])
    await ad.goto('/account')
    await ad.fill('input[name=username]', 'placement')
    await ad.locator('form', { hasText: 'Username' }).locator('input[name=current]').fill(PW)
    await ad.getByRole('button', { name: 'Save username' }).click()
    await toast(ad, /sign in as “placement”/)
    await ad.context().close()
    const ctx = await browser.newContext({ baseURL: BASE })
    const p = await ctx.newPage()
    await p.goto('/login')
    await p.getByRole('link', { name: 'Change password' }).click()
    await p.waitForURL('**/change-password')
    await p.fill('input[name=id]', 'placement')
    await p.fill('input[name=current]', PW)
    await p.fill('input[name=next]', 'Brand-New-Pass-77')
    await p.fill('input[name=confirm]', 'Brand-New-Pass-77')
    await p.getByRole('button', { name: /Change password & sign in/ }).click()
    await p.waitForURL('**/overview')
    await ctx.close()
    const again = await login('placement', 'Brand-New-Pass-77')
    await again.getByRole('heading', { name: 'Programme Overview' }).waitFor()
    await again.context().close()
  })

  await step('Daily register: upload the college sheet, auto-read date and marks, Verify, Confirm, locked', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sheet1')
    const d = new Date(Date.now() - 86400_000).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '.')
    ws.addRow(['Sl No.', 'Student ID NO', 'Parent Branch', 'Branch', 'Student Name', 3, 4, 5, 6, '', 8, 9])
    ws.addRow(['', '', '', '', '', '9.20 AM to 10.10 AM', '10.10 AM to 11.00 AM', '11.10 AM to 12.00 PM', '12.00 PM to 12.50 PM', '12.50 PM to 1.50 PM', '1.50 PM to 2.40 PM', '2.40 PM to 3.30 PM'])
    ws.addRow(['', '', '', '', '', d])
    ws.mergeCells(3, 6, 3, 12)
    const rows: [string, string, string[]][] = [['2300030001', 'Asha Rao', ['P', 'P', 'P', 'P', 'P', 'P']], ['2300030002', 'Bharat Kumar', ['A', 'A', 'P', 'P', 'P', 'P']], ['2300030003', 'Chitra Devi', ['A', 'A', 'A', 'A', 'A', 'A']], ['2300030004', 'Dev Patel', ['P', 'P', 'P', 'P', 'P', 'P']]]
    rows.forEach(([id, n, m], i) => ws.addRow([i + 1, id, 'CSE', 'CSE1', n, ...m.slice(0, 4), 'Lunch Break', ...m.slice(4)]))
    const file = join(tmp, `attendance ${d}.xlsx`)
    await wb.xlsx.writeFile(file)

    await aa.goto('/attendance/register')
    await aa.setInputFiles('input[type=file]:not([multiple])', file)
    await toast(aa, /Read 4 students for/)
    const iso = d.split('.').reverse().join('-')
    assert.equal(await aa.locator('input[type=date]').nth(1).inputValue(), iso)
    await aa.getByRole('button', { name: 'Verify' }).click()
    const v = aa.locator('dialog[open]')
    await v.getByText('2 absentees').waitFor()
    await v.getByText('All periods').waitFor() // Chitra
    await v.getByText('3, 4').waitFor() // Bharat
    await v.getByRole('button', { name: 'Confirm & lock' }).click()
    await toast(aa, /saved and locked/)
    await aa.getByText(/Posted by .* · locked/).waitFor()
    assert.equal(await aa.getByRole('button', { name: 'Verify' }).count(), 0)
    const marks = await mongoose.connection.collection('attendances').countDocuments({ date: { $gte: new Date(`${iso}T00:00:00+05:30`) }, status: 'absent' })
    assert.equal(marks, 8) // 2 + 6
    ;(globalThis as Record<string, unknown>).regDay = iso
  })

  await step('Locked register: change needs a reason, assistant cannot approve, Director approves, history kept', async () => {
    const iso = (globalThis as Record<string, unknown>).regDay as string
    await aa.goto(`/attendance/register?day=${iso}`)
    const d = await open(aa, 'Request change')
    await d.locator('select[name=student]').selectOption({ label: '2300030002 · Bharat Kumar' })
    await d.locator('select[name=period]').selectOption('3')
    await d.locator('textarea[name=reason]').fill('Was at the placement cell with permission')
    await d.getByRole('button', { name: 'Send for Director approval' }).click()
    await toast(aa, /Change requested/)
    await aa.reload()
    assert.equal(await aa.getByRole('button', { name: 'Approve' }).count(), 0)
    const dir = await login(staff.Director)
    await dir.goto('/notifications')
    await dir.getByText(/Attendance change awaiting approval/).waitFor()
    await dir.goto(`/attendance/register?day=${iso}`)
    await dir.getByRole('button', { name: 'Approve' }).click()
    await toast(dir, 'Approved and applied')
    const bharat = await mongoose.connection.collection('students').findOne({ regNo: '2300030002' })
    const absentNow = await mongoose.connection.collection('attendances').countDocuments({ student: bharat!._id, date: { $gte: new Date(`${iso}T00:00:00+05:30`) }, status: 'absent' })
    assert.equal(absentNow, 1)
    const day = await (await dir.request.get(`/api/attendance/day?day=${iso}&format=csv`)).text()
    assert.match(day, /Lunch Break/)
    assert.match(day, /"Student Name","Placement Mail ID"/)
    assert.match(day, /"Chitra Devi","[^"]*","A","A","A","A","Lunch Break","A","A"/)
    const cons = await (await dir.request.get('/api/attendance/consolidated?format=csv')).text()
    assert.match(cons, /Attendance %/)
    assert.match(cons, /"Bharat Kumar","[^"]*","5\/6","6","5","1","83.33"/)
    const x = await dir.request.get('/api/attendance/consolidated?format=xlsx')
    assert.match(x.headers()['content-type'], /spreadsheetml/)
    await dir.context().close()
  })

  await step('Attendance: upload several day sheets at once; each date is read from its file; posted days are skipped', async () => {
    const ExcelJS = (await import('exceljs')).default
    const sheet = async (daysAgo: number, absent: string[]) => {
      const d = new Date(Date.now() - daysAgo * 86400_000).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '.')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Sheet1')
      ws.addRow(['Sl No.', 'Student ID NO', 'Parent Branch', 'Branch', 'Student Name', 3, 4, '', 8])
      ws.addRow(['', '', '', '', '', '9.20 AM to 10.10 AM', '10.10 AM to 11.00 AM', '12.50 PM to 1.50 PM', '1.50 PM to 2.40 PM'])
      ws.addRow(['', '', '', '', '', d])
      ;[['2300030001', 'Asha Rao'], ['2300030002', 'Bharat Kumar'], ['2300030003', 'Chitra Devi'], ['2300030004', 'Dev Patel']].forEach(([id, n], i) => {
        const m = absent.includes(id) ? 'A' : 'P'
        ws.addRow([i + 1, id, 'CSE', 'CSE1', n, m, m, 'Lunch Break', m])
      })
      const file = join(tmp, `bulk-${daysAgo}.xlsx`) // no date in the name: it must come from the sheet
      await wb.xlsx.writeFile(file)
      return { file, iso: d.split('.').reverse().join('-') }
    }
    const a = await sheet(2, ['2300030004']), b = await sheet(3, []), again = await sheet(1, [])
    await aa.goto('/attendance/register')
    await aa.getByText('Upload attendance — multiple files / dates').click()
    await aa.setInputFiles('input[type=file][multiple]', [a.file, b.file, again.file])
    await aa.getByText('Already posted — will be skipped').waitFor({ timeout: 20_000 })
    assert.equal(await aa.getByLabel('Date for bulk-2.xlsx').inputValue(), a.iso)
    assert.equal(await aa.getByLabel('Date for bulk-3.xlsx').inputValue(), b.iso)
    await aa.getByRole('button', { name: 'Verify 2 days' }).click()
    const v = aa.locator('dialog[open]')
    await v.getByText('Dev Patel').waitFor()
    await v.getByRole('button', { name: 'Confirm & lock 2 days' }).click()
    await toast(aa, '2 of 2 days saved and locked.')
    const regs = await mongoose.connection.collection('dailyregisters').find({ day: { $in: [a.iso, b.iso] } }).toArray()
    assert.equal(regs.length, 2)
    assert.equal(regs.find(r => r.day === a.iso)!.absences, 3) // Dev, 3 periods
  })

  await step('Exports & reports: Excel for staff, branded printable view', async () => {
    const r = await sa.request.get('/api/reports/applications?format=xlsx')
    assert.equal(r.status(), 200)
    assert.match(r.headers()['content-type'], /spreadsheetml/)
    const c = await sa.request.get('/api/reports/attendance?format=csv')
    assert.match(await c.text(), /"Asha Rao","asha.personal@example.com"/) // Placement Mail ID in every student download
    for (const kind of ['students', 'performance', 'coding', 'placement', 'applications', 'assessments']) {
      const t = await (await sa.request.get(`/api/reports/${kind}?format=csv`)).text()
      assert.match(t.split('\n')[0], /Placement Mail ID/, kind)
    }
    await sa.goto('/reports/performance')
    await sa.getByText('Confidential').waitFor()
  })

  await step('Audit log records imports, corrections, status changes, approvals and registrations', async () => {
    const actions = await mongoose.connection.collection('auditlogs').distinct('action')
    for (const a of ['student.import', 'attendance.correct', 'results.update', 'application.status', 'register.changeApproved', 'account.selfRegister', 'onboarding.complete', 'account.bulkCreate', 'user.create', 'report.export']) assert.ok(actions.includes(a), `missing audit ${a}`)
    await sa.goto('/audit?q=attendance.correct')
    await sa.getByText('attendance.correct').first().waitFor()
  })

  await step('Roles: custom role with chosen permissions; deactivation revokes sessions', async () => {
    await sa.goto('/roles?new=1')
    await sa.fill('input[name=name]', 'Coordinator')
    await sa.getByLabel('Students: view').check()
    await sa.getByRole('button', { name: 'Create role' }).click()
    await toast(sa, 'Role Coordinator created')
    await sa.goto('/roles?edit=trainer')
    await sa.getByLabel('Reports: export').check()
    await sa.getByRole('button', { name: 'Save permissions' }).click()
    await toast(sa, 'Trainer updated')
    const victim = await login(staff.Administrator)
    await sa.goto('/users?q=admin%40marq.test')
    sa.once('dialog', d => d.accept())
    await sa.getByRole('button', { name: 'Deactivate' }).click()
    await toast(sa, /deactivated/)
    await victim.goto('/overview')
    await victim.waitForURL('**/login')
  })

  await step('Account lockout after 5 failed sign-ins', async () => {
    const ctx = await browser.newContext({ baseURL: BASE })
    const p = await ctx.newPage()
    for (let i = 0; i < 6; i++) {
      await p.goto('/login')
      await p.fill('input[name=id]', staff['Placement Administrator'])
      await p.fill('input[name=password]', i < 5 ? 'wrong-password-123' : PW)
      await p.click('button:has-text("Sign in")')
      await p.getByRole('alert').waitFor()
    }
    await p.getByText('Too many failed attempts').waitFor()
    await ctx.close()
  })

  await step('Cron endpoint requires its secret', async () => {
    assert.equal((await fetch(`${BASE}/api/cron/coding`)).status, 401)
    const r = await (await fetch(`${BASE}/api/cron/coding`, { headers: { authorization: 'Bearer test-cron' } })).json()
    assert.ok(r.ranked >= 1)
  })

  await step('Dark theme toggles and persists', async () => {
    await sa.goto('/overview')
    await sa.getByRole('button', { name: 'Toggle dark mode' }).first().click()
    await sa.reload()
    assert.equal(await sa.evaluate(() => document.documentElement.classList.contains('dark')), true)
  })

  await step('Student import: sample file, roster headings (Student ID NO, Parent Branch, Branch) and default university email', async () => {
    const sample = await aa.request.get('/api/students/template?sample=1')
    assert.match(sample.headers()['content-disposition'], /sample/)
    const roster = join(tmp, 'roster.csv')
    writeFileSync(roster, 'Sl No.,Student ID NO,Parent Branch,Branch,Student Name\n1,2300031111,CSE,CSE-H,Roster Student\n')
    await aa.goto('/students/import')
    await aa.setInputFiles('input[type=file]', roster)
    await aa.getByRole('button', { name: /Validate/ }).click()
    await aa.getByRole('button', { name: /Confirm import \(1\)/ }).click()
    await toast(aa, 'Import complete: 1 added')
    const st = await mongoose.connection.collection('students').findOne({ regNo: '2300031111' })
    assert.equal(st?.email, '2300031111@kluniversity.in')
    assert.equal(st?.department, 'CSE')
    assert.equal(st?.specialization, 'CSE-H')
  })

  await step('Delete student: confirmed by typing the ID; profile and linked records removed; audited', async () => {
    const st = await mongoose.connection.collection('students').findOne({ regNo: '2300031111' })
    await mongoose.connection.collection('codingstats').insertOne({ student: st!._id, platform: 'leetcode', handle: 'x', points: 10 })
    await aa.goto(`/students/${st!._id}`)
    await aa.getByRole('button', { name: 'Delete student' }).click()
    const d = aa.locator('dialog[open]')
    const del = d.getByRole('button', { name: 'Delete permanently' })
    assert.equal(await del.isDisabled(), true)
    await d.getByLabel('Type the student ID to confirm').fill('2300031111')
    await del.click()
    await aa.waitForURL('**/students')
    await toast(aa, /Roster Student \(2300031111\) and all their records were deleted/)
    assert.equal(await mongoose.connection.collection('students').countDocuments({ regNo: '2300031111' }), 0)
    assert.equal(await mongoose.connection.collection('codingstats').countDocuments({ student: st!._id }), 0)
    assert.equal(await mongoose.connection.collection('auditlogs').countDocuments({ action: 'student.delete', target: String(st!._id) }), 1)
  })

  await step('Every navigation page renders without server errors for Super Admin', async () => {
    for (const path of ['/attendance/register', '/reports/coding', '/overview', '/students', '/users', '/roles', '/training', '/attendance', '/assessments', '/performance', '/mentors', '/companies', '/jobs', '/applications', '/placement', '/reports', '/announcements', '/inbox', '/audit', '/settings', '/notifications', '/account', `/students/${ids['2300030001']}`]) {
      const r = await sa.goto(path)
      assert.equal(r?.status(), 200, path)
    }
    // aborted navigations ("stream closed early") are the test moving on, not app errors
    assert.doesNotMatch(serverLog.replace(/⨯ Error: The destination stream closed early\.[^}]*}/g, ''), /⨯|Error:/)
  })

  console.log(`\n${passed} end-to-end checks passed.`)
} catch (e) {
  console.log('FAILED')
  console.error(e)
  console.error('--- server log (tail) ---\n' + serverLog.slice(-4000))
  process.exitCode = 1
} finally {
  await browser.close()
  server.kill()
  await mongoose.disconnect()
}
