// Server-only boundary. This model contains credentials and must never reach client props.
import type { Payload, PayloadRequest } from 'payload'
import { isSmtpEmailAddress, parseSmtpEnv } from '@/utilities/env'
import { openSecret } from '@/utilities/secretBox'

export type EmailConnection = {
  host: string
  port: number
  security: 'none' | 'starttls' | 'tls'
  user?: string
  password?: string
}
export type EmailConfiguration = {
  source: 'env' | 'settings' | 'none'
  status: 'configured' | 'missing' | 'undecryptable' | 'invalid'
  connection?: EmailConnection
  from?: { address: string; name?: string }
}
type SmtpSettings = {
  smtpHost?: string | null
  smtpPort?: number | null
  smtpSecurity?: string | null
  smtpUser?: string | null
  smtpFromAddress?: string | null
  smtpFromName?: string | null
  smtpPasswordEncrypted?: string | null
}
const safeHeader = (value: string) => !/[\r\n\0]/.test(value)

export async function getEmailConfiguration(
  payload: Payload,
  req?: PayloadRequest,
): Promise<EmailConfiguration> {
  // Read at send time so recovery overrides and changed Settings apply immediately.
  if (process.env.SMTP_HOST?.trim()) {
    try {
      const env = parseSmtpEnv(process.env)!
      if (!env.fromAddress) return { source: 'env', status: 'missing' }
      return {
        source: 'env',
        status: 'configured',
        connection: {
          host: env.host,
          port: env.port,
          security: env.security,
          ...(env.user ? { user: env.user } : {}),
          ...(env.password ? { password: env.password } : {}),
        },
        from: { address: env.fromAddress, ...(env.fromName ? { name: env.fromName } : {}) },
      }
    } catch {
      return { source: 'env', status: 'invalid' }
    }
  }
  const settings: SmtpSettings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  })
  const host = settings.smtpHost?.trim()
  if (!host) return { source: 'none', status: 'missing' }
  const address = settings.smtpFromAddress?.trim()
  if (!address) return { source: 'settings', status: 'missing' }
  const port = settings.smtpPort ?? 587
  const security = settings.smtpSecurity ?? 'starttls'
  const name = settings.smtpFromName?.trim()
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !['none', 'starttls', 'tls'].includes(security) ||
    !safeHeader(host) ||
    !isSmtpEmailAddress(address) ||
    (name && !safeHeader(name))
  )
    return { source: 'settings', status: 'invalid' }
  const encrypted = settings.smtpPasswordEncrypted
  const decrypted = encrypted ? openSecret(encrypted, payload.secret) : undefined
  if (decrypted && !decrypted.ok) return { source: 'settings', status: 'undecryptable' }
  const user = settings.smtpUser?.trim()
  return {
    source: 'settings',
    status: 'configured',
    connection: {
      host,
      port,
      security: security as EmailConnection['security'],
      ...(user ? { user } : {}),
      ...(decrypted?.ok ? { password: decrypted.value } : {}),
    },
    from: { address, ...(name ? { name } : {}) },
  }
}
