// Profile pictures are never stored in MARQ: a Google Drive link the student chooses, else their GitHub avatar, else initials.

const DRIVE_ID = /^[A-Za-z0-9_-]{20,80}$/
const GH = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/

/** Accepts any Google Drive share link and returns the file id, or null when it isn't one. */
export function driveId(link: string): string | null {
  let u: URL
  try { u = new URL(link.trim()) } catch { return null }
  if (u.protocol !== 'https:' || !/^(drive|docs)\.google\.com$/.test(u.hostname)) return null
  const id = u.pathname.match(/\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id')
  return id && DRIVE_ID.test(id) ? id : null
}

/** Normalised link saved on the student (just the link — no image bytes). */
export const drivePhotoLink = (id: string) => `https://drive.google.com/file/d/${id}/view`

export function avatarSrc(s: { photoUrl?: string | null; handles?: { github?: string | null } | null; professional?: { github?: string | null } | null }) {
  const id = s.photoUrl ? driveId(s.photoUrl) : null
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w256`
  const gh = (s.handles?.github ?? '').trim()
  if (GH.test(gh)) return `https://github.com/${gh}.png?size=160`
  return null
}
