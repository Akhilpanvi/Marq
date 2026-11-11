// Shared application vocabulary (client + server).
export const APP_STATUSES = [
  'Not Applied', 'Applied', 'Applied - No Response', 'Written Test Scheduled', 'Written Test Completed', 'Written Test Rejected',
  'Technical Interview Scheduled', 'Technical Interview Completed', 'Technical Round Rejected',
  'HR Interview Scheduled', 'HR Interview Completed', 'HR Rejected',
  'Offered', 'Accepted', 'Declined', 'Withdrawn',
] as const

export const REJECTED = ['Written Test Rejected', 'Technical Round Rejected', 'HR Rejected']
export const CLOSED = [...REJECTED, 'Accepted', 'Declined', 'Withdrawn']
export const OFFERED = ['Offered', 'Accepted', 'Declined']

export function statusTone(s: string): 'zinc' | 'brand' | 'green' | 'amber' | 'red' | 'blue' {
  if (s === 'Accepted' || s === 'Offered') return 'green'
  if (REJECTED.includes(s)) return 'red'
  if (s === 'Declined' || s === 'Withdrawn' || s === 'Not Applied' || s === 'Applied - No Response') return 'zinc'
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

/** The programme's drive-status question (same options as the Google Form), mapped to MARQ statuses. */
export const DRIVE_OPTIONS = [
  ['Not applied', 'Not Applied'],
  ['Applied but no response', 'Applied - No Response'],
  ['Applied and attended the online exam', 'Written Test Completed'],
  ['Rejected in online exam', 'Written Test Rejected'],
  ['Qualified for Technical Interview Round (TR)', 'Technical Interview Scheduled'],
  ['Rejected in Technical Interview Round (TR)', 'Technical Round Rejected'],
  ['Qualified in HR', 'HR Interview Completed'],
  ['Rejected in HR', 'HR Rejected'],
  ['Final select / Offer rolled out', 'Offered'],
] as const
export const driveLabel = (status?: string) => DRIVE_OPTIONS.find(([, s]) => s === status)?.[0]
