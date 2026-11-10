'use client'
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
