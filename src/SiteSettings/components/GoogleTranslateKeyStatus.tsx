import type { ServerProps } from 'payload'
import { EncryptedSecretStatus } from '@/fields/EncryptedSecretStatus'

export async function GoogleTranslateKeyStatus({
  payload,
  user,
}: Pick<ServerProps, 'payload' | 'user'>) {
  return EncryptedSecretStatus({
    payload,
    user,
    encryptedField: 'googleTranslateApiKeyEncrypted',
    className: 'google-translate-key-status',
  })
}
