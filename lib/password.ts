import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (p: string, s: Buffer, len: number) => Promise<Buffer>

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored?: string | null) {
  const [, salt, hash] = stored?.split('$') ?? []
  const expected = hash ? Buffer.from(hash, 'base64') : Buffer.alloc(64)
  const actual = await scryptAsync(password, salt ? Buffer.from(salt, 'base64') : Buffer.alloc(16), 64)
  return !!hash && timingSafeEqual(actual, expected)
}

export const passwordIssue = (p: string) =>
  p.length < 10 ? 'Use at least 10 characters.' : p.length > 128 ? 'Password is too long.' : null
