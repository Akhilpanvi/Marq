'use client'
import { useEffect } from 'react'
import { Printer } from 'lucide-react'

export function PrintButton({ label = 'Print' }: { label?: string }) {
  return <button type="button" className="btn-outline" onClick={() => window.print()}><Printer className="size-4" />{label}</button>
}

/** Opens the browser's print dialog (Save as PDF) as soon as the page has loaded. */
export function AutoPrint() {
  useEffect(() => { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t) }, [])
  return null
}
