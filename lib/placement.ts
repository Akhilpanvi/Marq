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

/* ───────────── Student-facing drive status (plain language) ─────────────
   One list drives the status pop-up, the card summary, the dashboard nudges and server validation.
   `value` is always a real application status, so reports and analytics are unchanged. */

export type DriveGroup = 'none' | 'going' | 'out' | 'offer' | 'decision'
export type DriveChoice = { value: string; group: DriveGroup; emoji: string; title: string; help: string; summary: string }

export const DRIVE_CHOICES: DriveChoice[] = [
  { value: 'Not Applied', group: 'none', emoji: '🚫', title: 'I didn’t apply for this', help: 'You skipped this company.', summary: 'You did not apply' },
  { value: 'Applied - No Response', group: 'going', emoji: '📨', title: 'I applied — no reply yet', help: 'You submitted the application and haven’t heard back.', summary: 'Applied — waiting for a reply' },
  { value: 'Written Test Completed', group: 'going', emoji: '📝', title: 'I wrote the online test', help: 'You attended the test and are waiting for the result.', summary: 'Wrote the online test — waiting for the result' },
  { value: 'Technical Interview Scheduled', group: 'going', emoji: '💻', title: 'I’m in the technical interview round', help: 'You cleared the online test and are shortlisted for (or attending) the technical interview.', summary: 'In the technical interview round' },
  { value: 'HR Interview Completed', group: 'going', emoji: '🤝', title: 'I’m in the HR round', help: 'You cleared the technical interview and reached the HR stage.', summary: 'In the HR round' },
  { value: 'Written Test Rejected', group: 'out', emoji: '✖️', title: 'Not selected after the online test', help: 'The company told you that you didn’t clear the test.', summary: 'Not selected after the online test' },
  { value: 'Technical Round Rejected', group: 'out', emoji: '✖️', title: 'Not selected after the technical interview', help: 'You attended the technical interview but weren’t selected.', summary: 'Not selected after the technical interview' },
  { value: 'HR Rejected', group: 'out', emoji: '✖️', title: 'Not selected after the HR interview', help: 'You attended the HR interview but weren’t selected.', summary: 'Not selected after the HR interview' },
  { value: 'Offered', group: 'offer', emoji: '🎉', title: 'I got the offer!', help: 'The company selected you and you received an offer (mail, letter or call).', summary: 'Received an offer' },
  { value: 'Accepted', group: 'decision', emoji: '✅', title: 'I accepted the offer', help: 'You said yes to the offer.', summary: 'Accepted the offer' },
  { value: 'Declined', group: 'decision', emoji: '↩️', title: 'I declined the offer', help: 'You said no to the offer.', summary: 'Declined the offer' },
]
export const DRIVE_GROUPS: { id: DriveGroup; title: string }[] = [
  { id: 'none', title: 'I didn’t apply' },
  { id: 'going', title: 'I applied — still in the process' },
  { id: 'offer', title: 'I received an offer' },
  { id: 'decision', title: 'About the offer' },
  { id: 'out', title: 'I wasn’t selected' },
]
/** Statuses a student can choose from the pop-up. Accepted / Declined only make sense after an offer. */
export const driveChoicesFor = (current?: string | null) =>
  DRIVE_CHOICES.filter(c => c.group !== 'decision' || ['Offered', 'Accepted', 'Declined'].includes(current ?? ''))
export const driveChoice = (status?: string | null) => DRIVE_CHOICES.find(c => c.value === status) ?? (status === 'Applied' ? DRIVE_CHOICES[1] : undefined)

/** "Waiting" statuses: the student is waiting for the company. After NUDGE_DAYS without an update we ask for news. */
export const WAITING_STATUSES = ['Applied', 'Applied - No Response', 'Written Test Completed', 'Technical Interview Scheduled', 'HR Interview Completed']
export const NUDGE_DAYS = 7
export const isWaiting = (status?: string | null) => WAITING_STATUSES.includes(status ?? '')
export const daysSince = (d?: Date | string | null) => (d ? Math.floor((Date.now() - +new Date(d)) / 86_400_000) : 0)
