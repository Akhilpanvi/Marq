// Edge-safe signed session token: base64url(payload).base64url(hmac)
export type Session = { sub: string; v: number; exp: number }

export const COOKIE = '__Host-marq'
export const COOKIE_DEV = 'marq'
export const MAX_AGE = 60 * 60 * 24 * 7

const enc = new TextEncoder()
const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

let key: Promise<CryptoKey> | undefined
function getKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters')
  return (key ??= crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']))
}

export const cookieName = () => (process.env.NODE_ENV === 'production' ? COOKIE : COOKIE_DEV)

export async function seal<T extends object>(payload: T, ttlSec: number) {
  const body = b64(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })))
  return `${body}.${b64(await crypto.subtle.sign('HMAC', await getKey(), enc.encode(body)))}`
}

export async function unseal<T>(token?: string): Promise<(T & { exp: number }) | null> {
  const [body, sig] = token?.split('.') ?? []
  if (!body || !sig) return null
  try {
    if (!(await crypto.subtle.verify('HMAC', await getKey(), unb64(sig), enc.encode(body)))) return null
    const s = JSON.parse(new TextDecoder().decode(unb64(body))) as T & { exp: number }
    return s.exp > Date.now() / 1000 ? s : null
  } catch {
    return null
  }
}

export const sign = (s: Omit<Session, 'exp'>) => seal(s, MAX_AGE)
export const verify = (token?: string) => unseal<Session>(token).then(s => (s?.sub ? s : null))
