export function ago(d?: Date | string | null) {
  if (!d) return 'never'
  const s = (Date.now() - +new Date(d)) / 1000
  for (const [unit, n] of [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]] as const)
    if (s >= n) return `${Math.floor(s / n)} ${unit}${Math.floor(s / n) > 1 ? 's' : ''} ago`
  return 'just now'
}

export const fmt = (n?: number | null, digits = 0) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: digits }))
export const pct = (n?: number | null) => (n == null ? '—' : `${Math.round(n)}%`)
export const day = (d?: Date | string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—')
export const dayTime = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'
export const isoDay = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')
export const initials = (name = '') => name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
