import Link from 'next/link'
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="mt-2 text-lg font-semibold">Page not found</h1>
        <Link href="/" className="btn-outline mt-6">Back to MARQ</Link>
      </div>
    </main>
  )
}
