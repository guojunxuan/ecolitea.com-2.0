// Server-only: Node crypto is intentionally unavailable to the client module graph.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const deriveKey = (secret: string) =>
  createHash('sha256').update('ecolitea:integrations:v1\0').update(secret).digest()

export function sealSecret(value: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function openSecret(
  value: string,
  secret: string,
): { ok: true; value: string } | { ok: false } {
  try {
    const [version, ivText, tagText, encryptedText, extra] = value.split(':')
    if (version !== 'v1' || extra !== undefined || !ivText || !tagText || !encryptedText)
      return { ok: false }
    const iv = Buffer.from(ivText, 'base64url')
    const tag = Buffer.from(tagText, 'base64url')
    if (iv.length !== 12 || tag.length !== 16) return { ok: false }
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv)
    decipher.setAuthTag(tag)
    return {
      ok: true,
      value: Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    }
  } catch {
    return { ok: false }
  }
}
