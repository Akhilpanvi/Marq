import { NextResponse, type NextRequest } from 'next/server'
import { cookieName, verify } from '@/lib/session'

// Optimistic gate only: every page and action re-verifies the user and their permissions against MongoDB.
const PUBLIC = ['/login', '/activate', '/forgot-password', '/change-password', '/register', '/feedback']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = await verify(req.cookies.get(cookieName())?.value)
  // Public pages always render: a signed-but-revoked cookie must still reach /login (the page re-checks the DB).
  if (PUBLIC.includes(pathname)) return NextResponse.next()
  if (!session) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/|brand/|api/health|api/cron/|icon.svg|marq-logo.svg|favicon.ico|robots.txt).*)'],
}
