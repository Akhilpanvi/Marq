import type { Types } from 'mongoose'
import { db } from '@/lib/db'
import { notifyStudents } from '@/lib/notify'
import { NUDGE_DAYS, WAITING_STATUSES } from '@/lib/placement'
import { Application } from '@/models'

export const maxDuration = 60

// Daily (vercel.json): ask students for news on drives they have marked "waiting" for a week or more. One notification per student.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  await db()
  const cutoff = new Date(Date.now() - NUDGE_DAYS * 86_400_000)
  // Demo student is excluded by the model's default read filter.
  const apps = await Application.find({
    status: { $in: WAITING_STATUSES },
    updatedAt: { $lt: cutoff },
    $or: [{ nudgedAt: { $exists: false } }, { nudgedAt: null }, { nudgedAt: { $lt: cutoff } }],
  }).select('student company').lean()
  const byStudent = new Map<string, { companies: string[]; ids: Types.ObjectId[] }>()
  for (const a of apps) {
    const g = byStudent.get(String(a.student)) ?? { companies: [], ids: [] }
    if (!g.companies.includes(a.company)) g.companies.push(a.company)
    g.ids.push(a._id)
    byStudent.set(String(a.student), g)
  }
  for (const [student, g] of byStudent) {
    const c = g.companies.slice(0, 3)
    const names = c.length > 1 ? `${c.slice(0, -1).join(', ')} and ${c[c.length - 1]}` : c[0]
    await notifyStudents([student], { title: 'Any news from your drives?', body: `${names} ${c.length > 1 ? 'are' : 'is'} still marked ‘waiting’ — tap to update`, link: '/me/jobs' })
  }
  const ids = [...byStudent.values()].flatMap(g => g.ids)
  if (ids.length) await Application.updateMany({ _id: { $in: ids } }, { $set: { nudgedAt: new Date() } }, { timestamps: false })
  return Response.json({ students: byStudent.size, applications: ids.length })
}
