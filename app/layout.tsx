import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Toaster } from '@/components/toast'
import { themeScript } from '@/components/theme'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-sora' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'https://marq.klef.me'),
  title: { default: 'MARQ · KL University', template: '%s · MARQ' },
  description: 'MARQ — Marquee Achievement & Readiness Quotient. Beyond Training. Towards Excellence.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#0b0d12' }, { color: '#a41c24' }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  )
}
