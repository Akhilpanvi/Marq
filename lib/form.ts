import { driveId, drivePhotoLink } from './avatar'
export type State = { ok?: string; error?: string; secret?: string; data?: unknown } | null

/** A user-facing validation/permission error; anything else is a bug and propagates. */
export class Invalid extends Error {}

export const REGNO = /^[A-Za-z0-9-]{3,20}$/
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const OID = /^[a-f0-9]{24}$/

export const str = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? '').trim().slice(0, max)

export function need(fd: FormData, key: string, label: string, max = 200) {
  const v = str(fd, key, max)
  if (!v) throw new Invalid(`${label} is required.`)
  return v
}

export function num(fd: FormData, key: string, { min = -Infinity, max = Infinity, label = key } = {}) {
  const raw = str(fd, key, 30)
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < min || n > max) throw new Invalid(`${label} must be a number between ${min} and ${max}.`)
  return n
}

export function link(fd: FormData, key: string) {
  const v = str(fd, key, 500)
  if (v && !/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(v)) throw new Invalid(`Enter a valid http(s) link for ${key}.`)
  return v || undefined
}

export function date(fd: FormData, key: string) {
  const v = str(fd, key, 25)
  if (!v) return undefined
  // date-only inputs are IST calendar days
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+05:30` : /T\d{2}:\d{2}$/.test(v) ? `${v}:00+05:30` : v)
  if (isNaN(+d)) throw new Invalid(`Enter a valid date for ${key}.`)
  return d
}

export function oid(fd: FormData, key: string) {
  const v = str(fd, key, 24)
  if (v && !OID.test(v)) throw new Invalid(`Invalid ${key}.`)
  return v || undefined
}

export const oids = (fd: FormData, key: string) => fd.getAll(key).map(String).filter(v => OID.test(v))

export const list = (fd: FormData, key: string) => [...new Set(str(fd, key, 1000).split(',').map(s => s.trim()).filter(Boolean))].slice(0, 30)

export function oneOf<T extends string>(fd: FormData, key: string, options: readonly T[], fallback?: T): T {
  const v = str(fd, key, 60) as T
  if (options.includes(v)) return v
  if (fallback !== undefined) return fallback
  throw new Invalid(`Choose a valid ${key}.`)
}

export async function attempt(fn: () => Promise<State>): Promise<State> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message }
    if ((e as { code?: number }).code === 11000) return { error: 'A record with these details already exists.' }
    throw e
  }
}

/** Optional Google Drive link for a profile picture. Only the link is kept — never the image. */
export function photoLink(fd: FormData): string | null {
  const v = str(fd, 'photoUrl', 500)
  if (!v) return null
  const id = driveId(v)
  if (!id) throw new Invalid('Profile picture must be a Google Drive share link (or leave it blank to use your GitHub picture).')
  return drivePhotoLink(id)
}
