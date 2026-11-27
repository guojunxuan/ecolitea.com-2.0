import type { ServerProps } from 'payload'
import { openSecret } from '@/utilities/secretBox'

export async function EncryptedSecretStatus({
  payload,
  user,
  encryptedField,
  className,
}: Pick<ServerProps, 'payload' | 'user'> & { encryptedField: string; className?: string }) {
  if (user?.role !== 'admin') return null
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const encrypted = (settings as unknown as Record<string, unknown>)[encryptedField]
  const decrypted =
    typeof encrypted === 'string' && encrypted ? openSecret(encrypted, payload.secret) : null
  const label = !encrypted
    ? 'Not configured'
    : decrypted?.ok
      ? `Configured ••••${decrypted.value.slice(-4)}`
      : 'Needs re-entry (cannot decrypt)'
  return <p className={className}>{label}</p>
}
