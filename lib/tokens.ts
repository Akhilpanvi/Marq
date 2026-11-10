import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { Types } from 'mongoose'
import { User } from '@/models'
import { appUrl, linkEmail, sendMail } from './mail'

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
const TTL = { activate: 7 * 86400_000, reset: 30 * 60_000 }

/** Issues a one-time link (only its hash is stored) and emails it when SMTP is configured. Returns the link when it was not emailed. */
export async function issueLink(user: { _id: Types.ObjectId; name: string; email: string }, purpose: 'activate' | 'reset') {
  const token = randomBytes(32).toString('base64url')
  await User.updateOne(
    { _id: user._id },
    { $set: { tokenHash: sha256(token), tokenPurpose: purpose, tokenExpires: new Date(Date.now() + TTL[purpose]), ...(purpose === 'activate' ? { invitedAt: new Date() } : {}) } },
  )
  const url = `${appUrl()}/activate?token=${token}`
  const sent = await sendMail({ to: user.email, ...linkEmail(purpose, user.name, url) }).catch(e => (console.error('mail failed', e), false))
  return sent ? null : url
}
