import { createHash } from 'node:crypto'

/** Trusts the first forwarded address; the deployment proxy must overwrite this header. */
export function getClientIp(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || undefined
}

export function hashClientIp(ip: string | undefined, salt: string): string {
  return createHash('sha256')
    .update(`${salt}:${ip ?? 'unknown'}`)
    .digest('hex')
}
