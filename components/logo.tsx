// MARQ wordmark: geometric letters, one colour each, drawn as paths so it renders identically everywhere.
// Colours come from --marq-* CSS variables, which switch for dark mode (see globals.css).

const LETTERS = (
  <g fillRule="evenodd">
    <polygon fill="var(--marq-m)" points="0,100 0,0 20,0 48,42 76,0 96,0 96,100 78,100 78,32 55,68 41,68 18,32 18,100" />
    <path fill="var(--marq-a)" transform="translate(106 0)" d="M0 100 L35 0 H55 L90 100 H71 L63.3 78 H26.7 L19 100 Z M32.3 62 H57.7 L45 25.7 Z" />
    <path fill="var(--marq-r)" transform="translate(206 0)" d="M0 0 H50 A30 30 0 0 1 58 59 L84 100 H63 L40 60 H18 V100 H0 Z M18 18 V42 H50 A12 12 0 0 0 50 18 Z" />
    <path fill="var(--marq-q)" transform="translate(300 0)" d="M50 0 A50 50 0 1 1 49.99 0 Z M50 18 A32 32 0 1 0 50.01 18 Z" />
    <line transform="translate(300 0)" x1="62" y1="62" x2="102" y2="102" stroke="var(--marq-m)" strokeWidth="18" />
  </g>
)

export function MarqWordmark({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 410 108" className={className} role="img" aria-label="MARQ">
      {LETTERS}
    </svg>
  )
}

/** The Q with its quotient slash — for favicons and tight spaces. */
export function MarqMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="-6 -6 116 116" className={className} role="img" aria-label="MARQ">
      <path fill="var(--marq-q)" fillRule="evenodd" d="M50 0 A50 50 0 1 1 49.99 0 Z M50 18 A32 32 0 1 0 50.01 18 Z" />
      <line x1="62" y1="62" x2="102" y2="102" stroke="var(--marq-m)" strokeWidth="18" />
    </svg>
  )
}

export const FULL_NAME = 'Marquee Achievement & Readiness Quotient'
export const TAGLINE = 'Beyond Training. Towards Excellence.'

export function MarqLockup({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: ['h-5', 'text-[10px]', 'hidden'], md: ['h-8', 'text-xs', 'text-[11px]'], lg: ['h-14', 'text-sm', 'text-xs'] }[size]
  return (
    <div className="flex flex-col gap-1.5">
      <MarqWordmark className={`${s[0]} w-auto self-start`} />
      <div className="leading-tight">
        <div className={`${s[1]} font-medium text-fg`}>{FULL_NAME}</div>
        <div className={`${s[2]} tracking-wide text-muted`}>{TAGLINE}</div>
      </div>
    </div>
  )
}

export function KlSeal({ className = 'size-9' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/kl-seal.png" alt="KL University" className={`${className} dark:rounded-full dark:bg-white dark:p-0.5`} />
}

export function KlLockup({ className = 'h-12 w-auto' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/kl-lockup.png" alt="KL University (Deemed to be University)" className={`${className} dark:rounded-md dark:bg-white dark:p-1.5`} />
}
