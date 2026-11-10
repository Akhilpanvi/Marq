import { db } from '@/lib/db'
import { notifyStudents } from '@/lib/notify'
import { Interview } from '@/models'

// Vercel cron (vercel.json): notify students of interviews in the next 24 hours, once per interview.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  await db()
  const due = await Interview.find({ status: 'scheduled', reminded: false, at: { $gte: new Date(), $lte: new Date(Date.now() + 24 * 3600_000) } }).lean()
  for (const i of due) {
    await notifyStudents([i.student], { title: `Reminder: ${i.company} — ${i.round}`, body: `${i.at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} · ${i.mode}${i.link ? ` · ${i.link}` : ''}`, link: '/me/interviews' })
    await Interview.updateOne({ _id: i._id }, { $set: { reminded: true } })
  }
  return Response.json({ reminded: due.length })
}
