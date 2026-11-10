import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

export const mailEnabled = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
export const appUrl = () => (process.env.APP_URL ?? 'https://marq.klef.me').replace(/\/$/, '')

const g = globalThis as unknown as { smtp?: Transporter }

/** Returns false (instead of throwing) when SMTP isn't configured, so callers fall back to copyable links. */
export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  if (!mailEnabled()) return false
  g.smtp ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_SECURE !== 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  })
  await g.smtp.sendMail({ from: process.env.SMTP_FROM ?? `MARQ <${process.env.SMTP_USER}>`, to, subject, text, html })
  return true
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

export function linkEmail(kind: 'activate' | 'reset', name: string, url: string) {
  const [subject, lead, cta, ttl] =
    kind === 'activate'
      ? ['Activate your MARQ account', 'An account has been created for you on MARQ, the KL University Marquee programme platform.', 'Activate account', '7 days']
      : ['Reset your MARQ password', 'A password reset was requested for your MARQ account.', 'Choose a new password', '30 minutes']
  return {
    subject,
    text: `Hi ${name},\n\n${lead} Open this link within ${ttl}:\n\n${url}\n\nIf you weren't expecting this, ignore this email.\n\nMARQ · KL University`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18181b">
  <img src="${esc(appUrl())}/marq-logo.svg" alt="MARQ" height="22" style="margin:0 0 4px">
  <p style="font-size:11px;color:#71717a;margin:0 0 24px">Marquee Achievement &amp; Readiness Quotient · KL University</p>
  <p>Hi ${esc(name)},</p>
  <p>${esc(lead)} This link expires in ${ttl}.</p>
  <p style="margin:28px 0"><a href="${esc(url)}" style="background:#a41c24;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;display:inline-block">${cta}</a></p>
  <p style="font-size:13px;color:#71717a">If you weren't expecting this, ignore this email.</p>
</div>`,
  }
}
