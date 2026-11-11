'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

/** Desktop: fixed left sidebar. Phone: compact top bar + full-height menu that opens on tap and closes on navigation. */
export function Sidebar({ brand, actions, footer, children }: { brand: React.ReactNode; actions: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const path = usePathname()
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => void (document.body.style.overflow = '')
  }, [open])
  return (
    <aside className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 lg:px-5 lg:pt-5 lg:pb-4">
        {brand}
        <div className="flex items-center lg:hidden">
          {actions}
          <button type="button" className="btn-ghost px-2" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen(o => !o)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <div id="app-menu" className={`${open ? 'block' : 'hidden'} h-[calc(100dvh-57px)] overflow-y-auto overscroll-contain border-t border-line px-3 pt-2 pb-6 lg:block lg:h-auto lg:flex-1 lg:border-t-0 lg:pt-0 lg:pb-4`}>
        {children}
        <div className="mt-4 border-t border-line pt-3 lg:hidden">{footer}</div>
      </div>
      <div className="hidden border-t border-line p-3 lg:block">{footer}</div>
    </aside>
  )
}
