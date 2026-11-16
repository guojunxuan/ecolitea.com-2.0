import type { ServerProps } from 'payload'
import { getIntegrations } from '../integrations'

export async function GoogleTranslateKeyStatus({
  payload,
  user,
}: Pick<ServerProps, 'payload' | 'user'>) {
  if (user?.role !== 'admin') return null
  const { translate } = await getIntegrations(payload)
  const label =
    translate.status === 'undecryptable'
      ? 'Needs re-entry (cannot decrypt)'
      : translate.status === 'configured'
        ? `Configured ••••${translate.apiKey!.slice(-4)}`
        : 'Not configured'
  return <p className="google-translate-key-status">{label}</p>
}
