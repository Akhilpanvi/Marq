'use client'
import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'

/** Runs before paint (inlined in <head>) so there is no light flash in dark mode. */
export const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="btn-ghost px-2"
      aria-label="Toggle dark mode"
      title="Toggle theme"
      onClick={() => localStorage.setItem('theme', document.documentElement.classList.toggle('dark') ? 'dark' : 'light')}
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  )
}

/** Paper is always light. While printing / saving as PDF, drop the dark class (so `dark:` colours go too) and put it back afterwards. */
export function PrintLight() {
  useEffect(() => {
    const root = document.documentElement
    let was = false
    const toLight = () => { if (root.classList.contains('dark')) { was = true; root.classList.remove('dark') } }
    const back = () => { if (was) { root.classList.add('dark'); was = false } }
    window.addEventListener('beforeprint', toLight)
    window.addEventListener('afterprint', back)
    const mq = window.matchMedia('print') // Safari and others report printing through the media query
    const onMq = (e: MediaQueryListEvent) => (e.matches ? toLight() : back())
    mq.addEventListener('change', onMq)
    return () => { window.removeEventListener('beforeprint', toLight); window.removeEventListener('afterprint', back); mq.removeEventListener('change', onMq) }
  }, [])
  return null
}
