'use server'
import { revalidatePath } from 'next/cache'
import { audit, guard } from '@/lib/auth'
import { attempt, Invalid, need, num, oid, oids, oneOf, str, type State } from '@/lib/form'
import { DEFAULT_SCORING, DIMENSIONS, CATEGORIES, type Dim } from '@/lib/scoring'
import { APP_STATUSES } from '@/lib/placement'
import { getScoring, putSetting } from '@/lib/settings'
import { notifyUsers } from '@/lib/notify'
import { Announcement, Role, Student, User } from '@/models'

/* ───────────── Announcements ───────────── */

const CATS = ['Training', 'Assessment', 'Placement', 'Opportunity', 'Interview', 'General'] as const

export async function createAnnouncement(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('announcements.create')
    const roles = fd.getAll('roles').map(String).slice(0, 20)
    const batches = oids(fd, 'batches')
    const a = await Announcement.create({ title: need(fd, 'title', 'Title', 160), body: need(fd, 'body', 'Message', 5000), category: oneOf(fd, 'category', CATS, 'General'), roles, batches, createdBy: me._id })
    // resolve the audience: role members, plus students in the chosen batches
    const roleIds = roles.length ? await Role.find({ key: { $in: roles } }).distinct('_id') : null
    const studentIds = batches.length ? await Student.find({ batch: { $in: batches } }).distinct('_id') : null
    const or: Record<string, unknown>[] = []
    if (roleIds) or.push({ role: { $in: roleIds } })
    if (studentIds) or.push({ student: { $in: studentIds } })
    const users = await User.find({ status: { $ne: 'inactive' }, ...(or.length ? { $or: or } : {}) }).distinct('_id')
    await notifyUsers(users, { title: `${a.category}: ${a.title}`, body: a.body.slice(0, 500), link: '/notifications' })
    await audit(me, 'announcements', 'announcement.create', a._id, undefined, { roles, batches, recipients: users.length })
    revalidatePath('/announcements')
    return { ok: `Published to ${users.length} user${users.length === 1 ? '' : 's'}.` }
  })
}

export async function deleteAnnouncement(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('announcements.delete')
    const a = await Announcement.findByIdAndDelete(oid(fd, 'id')).lean()
    if (!a) throw new Invalid('Announcement not found.')
    await audit(me, 'announcements', 'announcement.delete', a._id, a)
    revalidatePath('/announcements')
    return { ok: 'Announcement removed (notifications already delivered stay in inboxes).' }
  })
}

/* ───────────── Settings ───────────── */

export async function saveScoring(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('settings.edit')
    const before = await getScoring()
    const weights = (prefix: string) => Object.fromEntries((Object.keys(DIMENSIONS) as Dim[]).map(k => [k, num(fd, `${prefix}_${k}`, { min: 0, max: 100, label: `${DIMENSIONS[k]} weight` }) ?? 0])) as Record<Dim, number>
    const overall = weights('o'), readiness = weights('r')
    if (!Object.values(overall).some(Boolean) || !Object.values(readiness).some(Boolean)) throw new Invalid('At least one weight must be above zero.')
    const dims = Object.keys(DIMENSIONS).filter(k => k !== 'attendance')
    const categoryDim = Object.fromEntries(CATEGORIES.map(c => [c, str(fd, `c_${c}`, 20) || DEFAULT_SCORING.categoryDim[c]]).filter(([, v]) => dims.includes(v)))
    const t = (k: keyof typeof DEFAULT_SCORING.thresholds, max = 100) => num(fd, `t_${k}`, { min: 0, max, label: k }) ?? DEFAULT_SCORING.thresholds[k]
    const value = { overall, readiness, categoryDim, thresholds: { high: t('high'), attention: t('attention'), attendance: t('attendance'), trend: t('trend', 50) } }
    await putSetting('scoring', value)
    await audit(me, 'settings', 'scoring.update', 'scoring', before, value)
    revalidatePath('/', 'layout')
    return { ok: 'Scoring updated. Every score now uses the new formula.' }
  })
}

export async function saveStatuses(_: State, fd: FormData): Promise<State> {
  return attempt(async () => {
    const me = await guard('settings.edit')
    const extra = [...new Set(str(fd, 'extra', 2000).split('\n').map(s => s.trim()).filter(Boolean))].filter(s => !(APP_STATUSES as readonly string[]).includes(s)).slice(0, 30)
    if (extra.some(s => s.length > 60)) throw new Invalid('Statuses must be 60 characters or fewer.')
    await putSetting('extraStatuses', extra)
    await audit(me, 'settings', 'statuses.update', 'extraStatuses', undefined, extra)
    revalidatePath('/settings')
    return { ok: 'Application statuses updated.' }
  })
}
