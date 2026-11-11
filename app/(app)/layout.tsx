import Link from 'next/link'
import { Bell, LogOut } from 'lucide-react'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { onboardingState } from '@/lib/onboarding'
import { logout } from '@/app/actions/auth'
import { Avatar } from '@/components/ui'
import { Nav } from '@/components/nav'
import { Sidebar } from '@/components/sidebar'
import { ThemeToggle } from '@/components/theme'
import { KlSeal, MarqWordmark } from '@/components/logo'
import { Notification } from '@/models'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser()
  // self-registered (and newly invited) students finish onboarding before the portal opens
  if (me.student && !(await onboardingState(me.student))?.done) redirect('/onboarding')
  const unread = await Notification.countDocuments({ user: me._id, read: false })
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <Sidebar
        brand={
          <Link href="/" className="flex items-center gap-2.5" aria-label="MARQ home">
            <KlSeal className="size-8" />
            <span className="h-7 w-px bg-line" />
            <span className="leading-tight">
              <MarqWordmark className="h-[15px] w-auto" />
              <span className="mt-1 block text-[10px] text-muted">KL University · Marquee Programme</span>
            </span>
          </Link>
        }
        actions={<>
          <Link href="/notifications" className="btn-ghost relative px-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Bell className="size-4" />
            {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-brand-500" />}
          </Link>
          <ThemeToggle />
        </>}
        footer={
          <div className="flex items-center gap-2">
            <Link href="/account" prefetch={false} title="Account & password" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 hover:bg-subtle">
              <Avatar name={me.name} size="size-8" />
              <div className="min-w-0 flex-1 text-sm leading-tight">
                <div className="truncate font-medium">{me.name}</div>
                <div className="truncate text-xs text-muted">{me.roleName}</div>
              </div>
            </Link>
            {!me.student && (
              <Link href="/notifications" className="btn-ghost relative hidden px-2 lg:inline-flex" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <Bell className="size-4" />
                {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-brand-500" />}
              </Link>
            )}
            <span className="hidden lg:inline-flex"><ThemeToggle /></span>
            <form action={logout}><button className="btn-ghost px-2" aria-label="Sign out" title="Sign out"><LogOut className="size-4" /></button></form>
          </div>
        }
      >
        <Nav perms={me.perms} student={!!me.student} assigned={me.scope === 'assigned' && !me.student} unread={unread} />
      </Sidebar>
      <div className="flex min-w-0 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        <footer className="no-print border-t border-line px-6 py-4 text-center text-xs text-muted">
          MARQ · Marquee Achievement &amp; Readiness Quotient — Koneru Lakshmaiah Education Foundation (KL University)
        </footer>
      </div>
    </div>
  )
}
