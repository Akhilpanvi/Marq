import { Rating } from './rating'
import { Badge, Empty } from './ui'
import { day } from '@/lib/format'

type E = { _id: unknown; student?: unknown; date?: Date | null; createdAt: Date; mentor: unknown; ratings?: Record<string, number | null | undefined> | null; strengths?: string | null; weaknesses?: string | null; recommendations?: string | null; remarks?: string | null; followUp?: { date?: Date | null; note?: string | null; done?: boolean | null } | null }

export function EvaluationList({ items, mentorName, studentName }: { items: E[]; mentorName: Map<string, string>; studentName?: Map<string, string> }) {
  if (!items.length) return <Empty>No mentor evaluations yet.</Empty>
  return (
    <ol className="space-y-4">
      {items.map(e => (
        <li key={String(e._id)} className="rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">{mentorName.get(String(e.mentor)) ?? 'Mentor'}{studentName && <span className="text-muted"> → {studentName.get(String(e.student)) ?? 'student'}</span>}</span>
            <span className="text-xs text-muted">{day(e.date ?? e.createdAt)}</span>
          </div>
          {e.ratings && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              {Object.entries(e.ratings).filter(([, v]) => v).map(([k, v]) => <span key={k} className="flex items-center gap-1.5 capitalize">{k} <Rating value={v!} /></span>)}
            </div>
          )}
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {([['Strengths', e.strengths], ['Weaknesses', e.weaknesses], ['Recommendations', e.recommendations], ['Remarks', e.remarks]] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>
            ))}
          </dl>
          {e.followUp?.date && <div className="mt-3 text-xs"><Badge tone={e.followUp.done ? 'green' : 'amber'}>Follow-up {day(e.followUp.date)}{e.followUp.done ? ' · done' : ''}</Badge> {e.followUp.note}</div>}
        </li>
      ))}
    </ol>
  )
}
