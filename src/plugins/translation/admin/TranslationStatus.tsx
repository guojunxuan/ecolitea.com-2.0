import Link from 'next/link'
import { LanguageStatusTable } from './LanguageStatusTable'
import type { Payload, PayloadRequest, ServerProps } from 'payload'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { getTranslationInventory } from '../inventory'
import styles from './translationStatus.module.css'
import { serverEnv } from '@/utilities/env'

export async function getTranslationStatus(
  payload: Payload,
  req?: PayloadRequest,
  now = new Date(),
) {
  const [{ targetLocales, configuredLocales }, usage, inventory] = await Promise.all([
    getI18nSettings(payload, req),
    payload.findGlobal({ slug: 'translation-usage', depth: 0, req }),
    getTranslationInventory(payload, req, now),
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
    limit: serverEnv.TRANSLATION_MONTHLY_CHAR_LIMIT,
    reset,
    counts,
  }
}

export const translationProblemHref = (locale: string, status: 'failed' | 'waiting_quota') =>
  `/admin/collections/translations?where[locale][equals]=${encodeURIComponent(locale)}&where[status][equals]=${status}`

/** Public Payload UI-field server component. Status editing uses native array fields below. */
export async function TranslationStatus({
  payload,
  user,
  req,
}: Pick<ServerProps, 'payload' | 'user'> & { req?: PayloadRequest }) {
  if (!user) return null
  const summary = await getTranslationStatus(payload, req)
  return (
    <div className="translation-status">
      <p>
        {summary.characters.toLocaleString('en')} / {summary.limit.toLocaleString('en')} characters
        used
      </p>
      <div
        role="progressbar"
        aria-label="Monthly translation usage"
        aria-valuemin={0}
        aria-valuemax={summary.limit}
        aria-valuenow={Math.min(summary.characters, summary.limit)}
        className={styles.usageTrack}
      >
        <span
          data-translation-usage-fill
          className={styles.usageFill}
          style={{
            width: `${Math.min(100, Math.max(0, (summary.characters / summary.limit) * 100))}%`,
          }}
        />
      </div>
      <p>
        Resets {summary.reset.slice(0, 10)} UTC ·{' '}
        <Link href="/admin/globals/translation-usage">Usage details</Link>
      </p>
      <LanguageStatusTable summary={summary} />
      <p>
        <Link href="/admin/collections/translations">All translation requests</Link>
      </p>
    </div>
  )
}
