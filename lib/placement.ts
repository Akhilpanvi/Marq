// Shared application vocabulary (client + server).
export const APP_STATUSES = [
  'Not Applied', 'Applied', 'Written Test Scheduled', 'Written Test Completed',
  'Technical Interview Scheduled', 'Technical Interview Completed', 'Technical Round Rejected',
  'HR Interview Scheduled', 'HR Interview Completed', 'HR Rejected',
  'Offered', 'Accepted', 'Declined', 'Withdrawn',
] as const

export const REJECTED = ['Technical Round Rejected', 'HR Rejected']
export const CLOSED = [...REJECTED, 'Accepted', 'Declined', 'Withdrawn']
export const OFFERED = ['Offered', 'Accepted', 'Declined']

export function statusTone(s: string): 'zinc' | 'brand' | 'green' | 'amber' | 'red' | 'blue' {
  if (s === 'Accepted' || s === 'Offered') return 'green'
  if (REJECTED.includes(s)) return 'red'
  if (s === 'Declined' || s === 'Withdrawn' || s === 'Not Applied') return 'zinc'
  if (s.includes('Scheduled')) return 'amber'
  return 'blue'
}

export const appKey = (company: string, role: string) => `${company}|${role}`.toLowerCase().replace(/\s+/g, ' ').trim()

export function placementStatus(apps: { status: string }[]) {
  if (apps.some(a => a.status === 'Accepted')) return { label: 'Placed', tone: 'green' as const }
  if (apps.some(a => a.status === 'Offered')) return { label: 'Offer received', tone: 'green' as const }
  if (apps.some(a => !CLOSED.includes(a.status) && a.status !== 'Not Applied')) return { label: 'In process', tone: 'blue' as const }
  return { label: apps.length ? 'No active applications' : 'Not started', tone: 'zinc' as const }
}
