import { KlLockup, MarqLockup, MarqWordmark, FULL_NAME, TAGLINE } from './logo'
import { ThemeToggle } from './theme'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <KlLockup className="h-12 w-auto" />
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm py-12">
          <div className="mb-8 lg:hidden"><MarqLockup size="md" /></div>
          {children}
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Koneru Lakshmaiah Education Foundation (KL University)</p>
      </section>
      <section className="relative hidden overflow-hidden border-l border-line bg-[#0b0d12] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/kl-seal.png" alt="" className="pointer-events-none absolute -right-28 -bottom-28 w-[34rem] opacity-[0.06] invert" />
        <div className="dark relative flex h-full flex-col justify-center p-14">
          <MarqWordmark className="h-20 w-auto self-start" />
          <p className="mt-6 text-lg font-medium text-white">{FULL_NAME}</p>
          <p className="mt-1 text-sm tracking-wide text-zinc-400">{TAGLINE}</p>
          <ul className="mt-12 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-sm text-zinc-300">
            {['Training & attendance', 'Assessments & coding', 'Performance intelligence', 'Mentorship', 'Company drives & applications', 'Placement outcomes'].map(t => (
              <li key={t} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--marq-a)]" />{t}</li>
            ))}
          </ul>
          <p className="mt-14 text-xs text-zinc-500">The Top Notch Marquee Training Programme · KL University</p>
        </div>
      </section>
    </main>
  )
}
