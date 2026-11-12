import 'server-only'
import type { Types } from 'mongoose'
import { CodingStat, ScoreSnapshot, Student, Target } from '@/models'
import { platformPoints, PLATFORM_KEYS, type PlatformKey } from './coding-points'

// Platform connectors adapted from KLOOP's lib/platforms (same public endpoints).
const UA = 'Mozilla/5.0 (compatible; MARQBot/1.0; +https://marq.klef.me)'
async function get(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': UA, ...init.headers } })
  if (res.status === 429 || res.status >= 500) throw new Error(`${new URL(url).host} responded ${res.status}`)
  return res
}

type Stat = { rating?: number; maxRating?: number; contests?: number; lastChange?: number; solved?: number; easy?: number; medium?: number; hard?: number; history?: { name: string; rating: number; at: Date }[] }
const change = (h: { rating: number }[]) => (h.length >= 2 ? h.at(-1)!.rating - h.at(-2)!.rating : undefined)

const FETCH: Record<PlatformKey, (handle: string) => Promise<Stat | null>> = {
  async leetcode(handle) {
    const query = `query($u:String!){matchedUser(username:$u){submitStatsGlobal{acSubmissionNum{difficulty count}}}
      userContestRanking(username:$u){rating attendedContestsCount}
      userContestRankingHistory(username:$u){attended rating contest{title startTime}}}`
    const res = await get('https://leetcode.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com' }, body: JSON.stringify({ query, variables: { u: handle } }) })
    const { data } = await res.json()
    if (!data?.matchedUser) return null
    const n = Object.fromEntries((data.matchedUser.submitStatsGlobal.acSubmissionNum as { difficulty: string; count: number }[]).map(d => [d.difficulty.toLowerCase(), d.count]))
    const history = ((data.userContestRankingHistory ?? []) as { attended: boolean; rating: number; contest: { title: string; startTime: number } }[])
      .filter(h => h.attended).map(h => ({ name: h.contest.title, rating: Math.round(h.rating), at: new Date(h.contest.startTime * 1000) }))
    const rating = data.userContestRanking?.rating ? Math.round(data.userContestRanking.rating) : undefined
    return { solved: n.all ?? 0, easy: n.easy ?? 0, medium: n.medium ?? 0, hard: n.hard ?? 0, rating, maxRating: history.length ? Math.max(...history.map(h => h.rating)) : rating, contests: data.userContestRanking?.attendedContestsCount ?? 0, lastChange: change(history), history: history.slice(-24) }
  },
  async codechef(handle) {
    // no public API: parse the profile page
    const res = await get(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, { redirect: 'manual' })
    if (res.status !== 200) return null
    const html = await res.text()
    const num = (re: RegExp) => { const m = html.match(re); return m ? Number(m[1]) : undefined }
    const rating = num(/class="rating-number">\s*(\d+)/)
    if (rating == null) return null
    let history: { name: string; rating: number; at: Date }[] = []
    try {
      const all = JSON.parse(html.match(/date_versus_rating":\{"all":(\[[\s\S]*?\])\s*[,}]/)?.[1] ?? '[]')
      history = all.map((c: { name: string; rating: string; end_date: string }) => ({ name: c.name, rating: +c.rating, at: new Date(c.end_date) }))
    } catch {}
    return { rating, maxRating: num(/Highest Rating\s*(\d+)/), solved: num(/Total Problems Solved:\s*(\d+)/), contests: history.length, lastChange: change(history), history: history.slice(-24) }
  },
  async codeforces(handle) {
    const info = await get(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`).then(r => r.json())
    if (info.status !== 'OK') return null
    const u = info.result[0]
    const rated = await get(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`).then(r => r.json())
    const history = (rated.status === 'OK' ? rated.result : []).map((c: { contestName: string; newRating: number; ratingUpdateTimeSeconds: number }) => ({ name: c.contestName, rating: c.newRating, at: new Date(c.ratingUpdateTimeSeconds * 1000) }))
    return { rating: u.rating ?? 0, maxRating: u.maxRating ?? 0, contests: history.length, lastChange: change(history), history: history.slice(-24) }
  },
}

type GH = { repos: number; stars: number; followers: number; contributions?: number; languages: { name: string; n: number }[]; top: { name: string; url: string; stars: number; language?: string }[] }
type Repo = { name: string; url: string; stars: number; language?: string }

/** GitHub: GraphQL with GITHUB_TOKEN (5,000 req/h, includes contributions); public REST fallback (60 req/h per IP). */
async function fetchGithub(login: string): Promise<GH | null> {
  const token = process.env.GITHUB_TOKEN
  let repos: Repo[], total: number, followers: number, contributions: number | undefined
  if (token) {
    const query = `query($l:String!){user(login:$l){followers{totalCount}
      repositories(ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false,first:100,orderBy:{field:STARGAZERS,direction:DESC}){totalCount nodes{name url stargazerCount primaryLanguage{name}}}
      contributionsCollection{contributionCalendar{totalContributions}}}}`
    const res = await get('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { l: login } }) })
    if (res.status === 401) throw new Error('GITHUB_TOKEN was rejected')
    const { data } = await res.json()
    const u = data?.user
    if (!u) return null
    repos = u.repositories.nodes.map((r: { name: string; url: string; stargazerCount: number; primaryLanguage?: { name: string } }) => ({ name: r.name, url: r.url, stars: r.stargazerCount, language: r.primaryLanguage?.name }))
    total = u.repositories.totalCount
    followers = u.followers.totalCount
    contributions = u.contributionsCollection.contributionCalendar.totalContributions
  } else {
    const headers = { Accept: 'application/vnd.github+json' }
    const res = await get(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(res.status === 403 ? 'GitHub rate limit reached (set GITHUB_TOKEN)' : `GitHub responded ${res.status}`)
    const u = await res.json()
    const list = await get(`https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner`, { headers }).then(r => (r.ok ? r.json() : []))
    repos = list.filter((r: { fork: boolean }) => !r.fork).map((r: { name: string; html_url: string; stargazers_count: number; language?: string }) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count, language: r.language ?? undefined }))
    total = repos.length // non-fork, like the GraphQL path
    followers = u.followers
  }
  const langs: Record<string, number> = {}
  for (const r of repos) if (r.language) langs[r.language] = (langs[r.language] ?? 0) + 1
  return {
    repos: total, followers, contributions,
    stars: repos.reduce((t, r) => t + r.stars, 0),
    languages: Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, n })),
    top: [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5),
  }
}

export const HANDLE = /^[A-Za-z0-9_.-]{1,40}$/

/** Fetches every linked platform for one student and stores the result. Never throws for a platform failure. */
export async function syncStudent(id: Types.ObjectId | string) {
  const s = await Student.findById(id).select('handles').lean()
  if (!s) return
  await Promise.all(PLATFORM_KEYS.map(async p => {
    const handle = s.handles?.[p]
    if (!handle) return CodingStat.deleteOne({ student: s._id, platform: p })
    try {
      const st = await FETCH[p](handle)
      const set = st ? { ...st, status: 'ok', error: null, points: platformPoints(p, st) } : { status: 'not_found', error: null, points: 0 }
      await CodingStat.updateOne({ student: s._id, platform: p }, { $set: { handle, fetchedAt: new Date(), ...set } }, { upsert: true })
    } catch (e) {
      // keep the last good numbers; only mark the error
      await CodingStat.updateOne({ student: s._id, platform: p }, { $set: { handle, status: 'error', error: String((e as Error).message).slice(0, 200) } }, { upsert: true })
    }
  }).concat((async () => {
    const handle = s.handles?.github
    if (!handle) return void (await CodingStat.deleteOne({ student: s._id, platform: 'github' }))
    try {
      const g = await fetchGithub(handle)
      await CodingStat.updateOne({ student: s._id, platform: 'github' }, { $set: { handle, fetchedAt: new Date(), points: 0, error: null, ...(g ? { status: 'ok', github: g } : { status: 'not_found' }) } }, { upsert: true })
    } catch (e) {
      await CodingStat.updateOne({ student: s._id, platform: 'github' }, { $set: { handle, status: 'error', error: String((e as Error).message).slice(0, 200) } }, { upsert: true })
    }
  })()))
}

/** Syncs the stalest students first within a time budget (serverless-friendly). */
export async function syncStale(budgetMs = 45_000, concurrency = 4) {
  const start = Date.now()
  const linked = await Student.find({ status: { $nin: ['withdrawn', 'dropped'] }, $or: [...PLATFORM_KEYS, 'github'].map(p => ({ [`handles.${p}`]: { $nin: [null, ''] } })) }).select('_id').lean()
  const last = new Map((await CodingStat.aggregate<{ _id: Types.ObjectId; at: Date }>([{ $group: { _id: '$student', at: { $min: '$fetchedAt' } } }])).map(r => [String(r._id), +r.at || 0]))
  const queue = linked.map(s => s._id).sort((a, b) => (last.get(String(a)) ?? 0) - (last.get(String(b)) ?? 0))
  let done = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && Date.now() - start < budgetMs) {
      await syncStudent(queue.shift()!)
      done++
    }
  }))
  return done
}

export const istDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

/** Coding points per student (sum over platforms) for everyone on the leaderboard, ranked. */
export async function standings() {
  const [students, pts] = await Promise.all([
    Student.find({ status: { $nin: ['withdrawn', 'dropped'] }, onLeaderboard: { $ne: false } }).select('name regNo department batch').lean(),
    CodingStat.aggregate<{ _id: Types.ObjectId; points: number; by: { p: PlatformKey; points: number }[] }>([{ $group: { _id: '$student', points: { $sum: '$points' }, by: { $push: { p: '$platform', points: '$points' } } } }]),
  ])
  const m = new Map(pts.map(p => [String(p._id), p]))
  const rows = students.map(s => {
    const p = m.get(String(s._id))
    return { ...s, points: p?.points ?? 0, by: Object.fromEntries((p?.by ?? []).map(b => [b.p, b.points])) as Partial<Record<PlatformKey, number>> }
  }).sort((a, b) => b.points - a.points || a.regNo.localeCompare(b.regNo))
  return ranked(rows)
}

/** Competition ranking (1, 2, 2, 4) over rows already sorted by points, highest first. */
export function ranked<T extends { points: number }>(rows: T[]) {
  let rank = 0
  return rows.map((r, i) => ({ ...r, rank: i && r.points === rows[i - 1].points ? rank : (rank = i + 1) }))
}

/** Writes today's points + rank for every ranked student (idempotent; rerun overwrites today). */
export async function snapshotToday() {
  const day = istDay()
  const rows = await standings()
  if (rows.length) await ScoreSnapshot.bulkWrite(rows.map(r => ({ updateOne: { filter: { student: r._id, day }, update: { $set: { points: r.points, rank: r.rank } }, upsert: true } })))
  return rows.length
}

/** The target that applies now: the latest one already due, else the next upcoming. */
export async function currentTarget(batch?: Types.ObjectId | null) {
  if (!batch) return null
  const now = new Date()
  return (await Target.findOne({ batch, due: { $lte: now } }).sort({ due: -1 }).lean()) ?? (await Target.findOne({ batch, due: { $gt: now } }).sort({ due: 1 }).lean())
}
