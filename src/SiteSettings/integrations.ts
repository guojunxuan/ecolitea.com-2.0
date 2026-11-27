// Server-only boundary: never pass this model (which includes a credential) to client components.
import type { Payload, PayloadRequest } from 'payload'
import { validGtmId } from '@/consent/gtm'
import { openSecret } from '@/utilities/secretBox'

export const DEFAULT_TRANSLATION_MONTHLY_CHAR_LIMIT = 450000
export type Integrations = {
  gtm: { containerId: string | null; disabled: boolean }
  translate: {
    apiKey: string | null
    status: 'configured' | 'missing' | 'undecryptable'
    monthlyCharLimit: number
  }
}

export async function getIntegrations(
  payload: Payload,
  req?: PayloadRequest,
): Promise<Integrations> {
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
    req,
  })
  const encrypted = settings.googleTranslateApiKeyEncrypted
  const decrypted = encrypted ? openSecret(encrypted, payload.secret) : null
  const limit = settings.translationMonthlyCharLimit
  return {
    gtm: {
      containerId: validGtmId(settings.gtmContainerId ?? undefined),
      disabled: settings.disableGtm === true,
    },
    translate: {
      apiKey: decrypted?.ok ? decrypted.value : null,
      status: !encrypted ? 'missing' : decrypted?.ok ? 'configured' : 'undecryptable',
      monthlyCharLimit:
        typeof limit === 'number' && Number.isSafeInteger(limit) && limit > 0
          ? limit
          : DEFAULT_TRANSLATION_MONTHLY_CHAR_LIMIT,
    },
  }
}
