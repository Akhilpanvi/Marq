import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function Denied() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <ShieldAlert className="mx-auto size-8 text-muted" />
        <h1 className="mt-3 text-lg font-semibold">You don&apos;t have access to this page</h1>
        <p className="mt-1 text-sm text-muted">Your role does not include this permission. Contact a Super Administrator if you need it.</p>
        <Link href="/" className="btn-outline mt-6">Go to my dashboard</Link>
      </div>
    </main>
  )
}
