'use client'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  BarChart3, Bell, BookOpen, Code2, Inbox, MessageSquareHeart, KeyRound, Medal, Briefcase, Building2, CalendarCheck, ClipboardCheck, ClipboardList, FileText, Gauge,
  GraduationCap, LayoutDashboard, Megaphone, MessagesSquare, Settings, ShieldCheck, ScrollText, Trophy, UserCog, UserRound, Users, Video,
} from 'lucide-react'
import { hasPerm, type Perm } from '@/lib/rbac'

type Item = { href: string; label: string; icon: typeof Users; perm?: Perm; mine?: string }
const ADMIN: { group: string; items: Item[] }[] = [
  { group: '', items: [{ href: '/overview', label: 'Overview', icon: LayoutDashboard }] },
  {
    group: 'People',
    items: [
      { href: '/students', label: 'Students', mine: 'My Students', icon: GraduationCap, perm: 'students.view' },
      { href: '/users', label: 'User Management', icon: UserCog, perm: 'users.view' },
      { href: '/roles', label: 'Roles & Permissions', icon: ShieldCheck, perm: 'roles.view' },
      { href: '/mentors', label: 'Mentors', mine: 'Student Evaluations', icon: MessagesSquare, perm: 'mentorship.view' },
    ],
  },
  {
    group: 'Training',
    items: [
      { href: '/training', label: 'Training', mine: 'Training Progress', icon: BookOpen, perm: 'training.view' },
      { href: '/attendance/register', label: 'Daily Register', icon: ClipboardList, perm: 'attendance.view' },
      { href: '/attendance', label: 'Attendance', icon: CalendarCheck, perm: 'attendance.view' },
      { href: '/assessments', label: 'Assessments', icon: ClipboardCheck, perm: 'assessments.view' },
      { href: '/performance', label: 'Performance Intelligence', icon: Gauge, perm: 'performance.view' },
    ],
  },
  {
    group: 'Placements',
    items: [
      { href: '/companies', label: 'Companies', icon: Building2, perm: 'companies.view' },
      { href: '/jobs', label: 'Job Opportunities', icon: Briefcase, perm: 'jobs.view' },
      { href: '/applications', label: 'Applications', icon: ClipboardList, perm: 'applications.view' },
      { href: '/interviews', label: 'Interviews', icon: Video, perm: 'interviews.view' },
      { href: '/placement', label: 'Placement Analytics', icon: Trophy, perm: 'applications.view' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3, perm: 'reports.view' },
      { href: '/announcements', label: 'Announcements', icon: Megaphone, perm: 'announcements.view' },
      { href: '/inbox', label: 'Feedback Inbox', icon: Inbox, perm: 'feedback.view' },
      { href: '/audit', label: 'Audit Logs', icon: ScrollText, perm: 'audit.view' },
      { href: '/settings', label: 'Settings', icon: Settings, perm: 'settings.view' },
      { href: '/feedback', label: 'Send Feedback', icon: MessageSquareHeart },
    ],
  },
]
const STUDENT: Item[] = [
  { href: '/me', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/me/profile', label: 'My Profile', icon: UserRound },
  { href: '/me/training', label: 'My Training', icon: BookOpen },
  { href: '/me/attendance', label: 'My Attendance', icon: CalendarCheck },
  { href: '/me/assessments', label: 'My Assessments', icon: ClipboardCheck },
  { href: '/me/performance', label: 'My Performance', icon: Gauge },
  { href: '/me/coding', label: 'Coding Profiles', icon: Code2 },
  { href: '/me/leaderboard', label: 'Leaderboard', icon: Medal },
  { href: '/me/contests', label: 'Contest Leaderboard', icon: BarChart3 },
  { href: '/me/jobs', label: 'Job Opportunities', icon: Briefcase },
  { href: '/me/applications', label: 'My Applications', icon: ClipboardList },
  { href: '/me/interviews', label: 'My Interviews', icon: Video },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/account', label: 'Change Password', icon: KeyRound },
  { href: '/feedback', label: 'Feedback', icon: MessageSquareHeart },
]

function NavLink({ item, label, path }: { item: Item; label: string; path: string }) {
  const active = item.href === '/me' || item.href === '/attendance' ? path === item.href : path === item.href || path.startsWith(item.href + '/')
  const Icon = item.icon
  const ref = useRef<HTMLAnchorElement>(null)
  // on phones the nav is a horizontal strip: keep the current page's tab visible
  useEffect(() => { if (active && window.innerWidth < 1024) ref.current?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [active])
  return (
    <Link
      ref={ref}
      href={item.href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-subtle hover:text-fg'}`}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}

export function Nav({ perms, student, assigned, unread }: { perms: string[]; student: boolean; assigned: boolean; unread: number }) {
  const path = usePathname()
  if (student)
    return (
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {STUDENT.map(i => <NavLink key={i.href} item={i} path={path} label={i.href === '/notifications' && unread ? `${i.label} (${unread})` : i.label} />)}
      </nav>
    )
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-4">
      {ADMIN.map(g => {
        const items = g.items.filter(i => !i.perm || hasPerm(perms, i.perm))
        if (!items.length) return null
        return (
          <div key={g.group} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
            {g.group && <div className="hidden px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted/80 uppercase lg:block">{g.group}</div>}
            {items.map(i => <NavLink key={i.href} item={i} path={path} label={assigned && i.mine ? i.mine : i.label} />)}
          </div>
        )
      })}
    </nav>
  )
}
