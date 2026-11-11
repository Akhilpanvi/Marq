import { redirect } from 'next/navigation'
import { Eye, RotateCcw } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Card, PageHeader } from '@/components/ui'
import { openPreview, resetDemo } from '@/app/actions/preview'

export const metadata = { title: 'Student View (demo)' }

export default async function PreviewPage() {
  const me = await requireUser()
  if (me.preview) redirect('/me')
  if (!me.perms.includes('*')) redirect('/denied')
  return (
    <>
      <PageHeader title="Student View (demo)" description="See and use the student portal exactly as a student does — with a demo student that is never counted anywhere." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Open the student portal">
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>You browse as <b className="text-fg">Demo Student (DEMO-0001)</b>: dashboard, profile, coding profiles, drives, attendance, feedback…</li>
            <li>The demo student is hidden from every student list, the daily register, reports, leaderboards, analytics and all counts.</li>
            <li>A bar at the top lets you <b className="text-fg">Exit preview</b> and return to your Super Admin view. The preview ends by itself after 8 hours.</li>
          </ul>
          <form action={openPreview}><button className="btn-primary"><Eye className="size-4" />Open student view</button></form>
        </Card>
        <Card title="Start over">
          <p className="mb-4 text-sm text-muted">Clears everything the demo student did — coding profiles, profile details, drive answers, notifications — so you can walk the whole flow again, starting with onboarding.</p>
          <form action={resetDemo}><button className="btn-outline"><RotateCcw className="size-4" />Reset demo student</button></form>
        </Card>
      </div>
    </>
  )
}
