import type { Payload, PayloadRequest } from 'payload'
import { unstable_cache } from 'next/cache'
import { normalizeI18nSettings } from './settings'

export async function getI18nSettings(payload?: Payload, req?: PayloadRequest) {
  const read = async (client: Payload) =>
    normalizeI18nSettings(
      await client.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, req }),
    )
  if (payload) {
    if (!payload.config.globals.some(({ slug }) => slug === 'site-settings'))
      return normalizeI18nSettings({})
    return read(payload)
  }
  const load = async () => {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])
    return read(await getPayload({ config }))
  }
  return process.env.PLAYWRIGHT_TEST === 'true'
    ? load()
    : unstable_cache(load, ['i18n-settings'], { tags: ['global_site-settings'] })()
}
