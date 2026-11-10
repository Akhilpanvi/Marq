import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export default async function Home() {
  const me = await requireUser()
  redirect(me.student ? '/me' : '/overview')
}
