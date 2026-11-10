import 'server-only'
import { Application } from '@/models'
import { CLOSED, OFFERED, REJECTED } from './placement'

/** Application dashboard counters for any match (one student, a scope, or everyone). */
export async function appMetrics(match: Record<string, unknown>) {
  const [byStatus, companies] = await Promise.all([
    Application.aggregate<{ _id: string; n: number }>([{ $match: match }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Application.distinct('key', { ...match, status: { $ne: 'Not Applied' } }).then(keys => new Set(keys.map(k => k.split('|')[0])).size),
  ])
  const n = (pred: (s: string) => boolean) => byStatus.filter(r => pred(r._id)).reduce((t, r) => t + r.n, 0)
  return {
    total: n(() => true),
    companies,
    inProgress: n(s => !CLOSED.includes(s) && s !== 'Not Applied' && s !== 'Offered'),
    written: n(s => s.startsWith('Written Test')),
    technical: n(s => s.startsWith('Technical Interview')),
    hr: n(s => s.startsWith('HR Interview')),
    offers: n(s => OFFERED.includes(s)),
    accepted: n(s => s === 'Accepted'),
    rejected: n(s => REJECTED.includes(s)),
    byStatus: byStatus.sort((a, b) => b.n - a.n),
  }
}
