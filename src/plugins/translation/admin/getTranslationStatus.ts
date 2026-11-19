import type { Payload, PayloadRequest } from 'payload'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { getTranslationInventory } from '../inventory'
import { getIntegrations } from '@/SiteSettings/integrations'

export async function getTranslationStatus(
  payload: Payload,
  req?: PayloadRequest,
  now = new Date(),
) {
  const [{ targetLocales, configuredLocales }, usage, inventory, integrations] = await Promise.all([
    getI18nSettings(payload, req),
    payload.findGlobal({ slug: 'translation-usage', depth: 0, req }),
    getTranslationInventory(payload, req, now),
    getIntegrations(payload, req),
  ])
  const identities = new Set(
    inventory.map(({ input }) => `${input.sourceCollection}:${input.sourceId}`),
  )
  const month = now.toISOString().slice(0, 7)
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  const counts = await Promise.all(
    (configuredLocales ?? targetLocales).map(async ({ code, label, status }) => {
      const result = await payload.find({
        collection: 'translations',
        depth: 0,
        pagination: false,
        req,
        where: { locale: { equals: code } },
      })
      const rows = result.docs.filter((row) =>
        identities.has(`${row.sourceCollection}:${row.sourceId}`),
      )
      return {
        code,
        label,
        status,
        total: identities.size,
        ready: rows.filter((row) => Boolean(row.lastReadySourceVersion)).length,
        failed: rows.filter((row) => row.status === 'failed').length,
        waiting: rows.filter((row) => row.status === 'waiting_quota').length,
        updated: rows
          .map((row) => row.updatedAt)
          .filter(Boolean)
          .sort()
          .at(-1),
      }
    }),
  )
  return {
    month,
    total: identities.size,
    currentTime: now.getTime(),
    characters: usage.month === month ? (usage.characters ?? 0) : 0,
    limit: integrations.translate.monthlyCharLimit,
    reset,
    counts,
  }
}
