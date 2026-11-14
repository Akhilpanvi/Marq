import 'server-only'
import { Types } from 'mongoose'
import { Application, Job, Role, Student, User } from '@/models'
import { appUrl, sendMail } from './mail'
import { notifyUsers } from './notify'

/* ───────────── Drives: active vs archived ─────────────
   A finished drive is "archived" (kept aside, never deleted): it leaves every count, student card, banner and
   reminder, but stays in reports and history. Drives archive themselves ARCHIVE_DAYS after their deadline — or after
   they were posted when there is no deadline. Staff can archive / unarchive by hand. */

export const ARCHIVE_DAYS = 28
type F = Record<string, unknown>
const PUBLISHED: F = { status: { $in: ['open', 'closed'] } }
/** Published and not archived — what students see and what "answered" is counted against. */
export const ACTIVE_DRIVES: F = { ...PUBLISHED, archivedAt: null }

export async function autoArchiveDrives() {
  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 86_400_000)
  const due: F = { ...ACTIVE_DRIVES, $or: [{ deadline: { $lt: cutoff } }, { deadline: null, createdAt: { $lt: cutoff } }] }
  const r = await Job.updateMany(
    due,
    { $set: { archivedAt: new Date(), archivedAuto: true } },
  )
  return r.modifiedCount
}

export const archivedJobIds = () => Job.find({ archivedAt: { $ne: null } }).distinct('_id')

export type DriveOpt = { id: string; label: string; archived: boolean; when: string }
/** Every published drive for pickers: active ones first (newest first), then archived ones. */
export async function driveOptions(): Promise<DriveOpt[]> {
  const jobs = await Job.find(PUBLISHED).populate<{ company: { name: string } }>('company', 'name').select('role company archivedAt deadline createdAt').lean()
  return jobs
    .map(j => ({ id: String(j._id), label: `${j.company?.name ?? '—'} · ${j.role}`, archived: !!j.archivedAt, when: new Date(j.deadline ?? j.createdAt).toISOString().slice(0, 10) }))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || b.when.localeCompare(a.when))
}

/** "active" (default) · "all" · or a comma list of drive ids (any mix of active and archived). */
export async function selectDrives(sel?: string | null) {
  const ids = (sel ?? '').split(',').filter(x => /^[a-f0-9]{24}$/.test(x))
  if (ids.length) {
    const picked: F = { ...PUBLISHED, _id: { $in: ids.map(i => new Types.ObjectId(i)) } }
    const jobs = await Job.find(picked).populate<{ company: { name: string } }>('company', 'name').select('role company').lean()
    return { mode: 'pick' as const, jobs: jobs.map(j => j._id), label: jobs.length === 1 ? `${jobs[0].company?.name} · ${jobs[0].role}` : `${jobs.length} selected drives`, names: jobs.map(j => `${j.company?.name} · ${j.role}`) }
  }
  const all = sel === 'all'
  const jobs = await Job.find(all ? PUBLISHED : ACTIVE_DRIVES).select('_id').lean()
  return { mode: all ? ('all' as const) : ('active' as const), jobs: jobs.map(j => j._id), label: all ? `All drives (${jobs.length})` : `Active drives (${jobs.length})`, names: [] as string[] }
}

export type AnswerRow = { id: string; name: string; regNo: string; n: number }
/** For the chosen drives: how many each active student answered ("I didn't apply" counts). ID ascending. */
export async function answersFor(jobs: Types.ObjectId[], studentFilter: Record<string, unknown>) {
  const students = await Student.find({ ...studentFilter, status: 'active' }).select('name regNo').sort({ regNo: 1 }).lean()
  const per = new Map((await Application.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { job: { $in: jobs }, student: { $in: students.map(s => s._id) } } },
    { $group: { _id: '$student', jobs: { $addToSet: '$job' } } }, { $project: { n: { $size: '$jobs' } } },
  ])).map(x => [String(x._id), x.n]))
  const total = jobs.length
  const rows: AnswerRow[] = students.map(s => ({ id: String(s._id), name: s.name, regNo: s.regNo, n: Math.min(per.get(String(s._id)) ?? 0, total) }))
  return { total, rows }
}
export const answerGroup = (n: number, total: number) => (total > 0 && n >= total ? 'All answered' : n > 0 ? 'Partly answered' : 'Not answered yet')

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A student changed the status of an ARCHIVED drive: tell every Director and IRP (placement) admin — in MARQ and by email. */
export async function alertArchivedDriveUpdate(a: { _id: unknown; student: unknown; company: string; role: string }, from: string, to: string) {
  const [s, roles] = await Promise.all([
    Student.findById(a.student).select('name regNo').lean(),
    Role.find({ key: { $in: ['director', 'placement_admin'] } }).distinct('_id'),
  ])
  const staff = await User.find({ role: { $in: roles }, status: 'active' }).select('name email').lean()
  const who = s ? `${s.name} (${s.regNo})` : 'A student'
  const title = `Archived drive updated: ${who} — ${a.company}`
  const body = `${a.role}: ${from} → ${to}. This drive is archived; please check the change.`
  const link = `/applications/${a._id}`
  await notifyUsers(staff.map(u => u._id), { title, body, link })
  const url = `${appUrl()}${link}`
  await Promise.all(staff.map(u => sendMail({
    to: u.email,
    subject: `MARQ: ${who} updated an archived drive (${a.company})`,
    text: `Hi ${u.name},\n\n${who} changed their status for an archived drive.\n\n${a.company} — ${a.role}\n${from} → ${to}\n\nReview it: ${url}\n\nMARQ · KL University`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b">
  <p style="font-size:11px;color:#71717a;margin:0 0 20px">MARQ · Marquee Achievement &amp; Readiness Quotient · KL University</p>
  <p>Hi ${esc(u.name)},</p>
  <p><b>${esc(who)}</b> changed their status for an <b>archived</b> drive.</p>
  <p style="background:#f4f4f5;border-radius:8px;padding:12px 14px">${esc(a.company)} — ${esc(a.role)}<br><b>${esc(from)} → ${esc(to)}</b></p>
  <p style="margin:24px 0"><a href="${esc(url)}" style="background:#a41c24;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">Review the application</a></p>
</div>`,
  }).catch(e => (console.error('archived-drive mail failed', e), false))))
}
