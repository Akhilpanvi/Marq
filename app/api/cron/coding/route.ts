import { db } from '@/lib/db'
import { snapshotToday, syncStale } from '@/lib/coding'

export const maxDuration = 60

// Daily (vercel.json): refresh the stalest coding profiles within the time budget, then record today's ranks.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  await db()
  const synced = await syncStale(45_000)
  const ranked = await snapshotToday()
  return Response.json({ synced, ranked })
}
