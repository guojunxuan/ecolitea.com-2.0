import Link from 'next/link'
import { LanguageStatusTable } from './LanguageStatusTable'
import type { PayloadRequest, ServerProps } from 'payload'
import styles from './translationStatus.module.css'
import { getTranslationStatus } from './getTranslationStatus'

export { getTranslationStatus } from './getTranslationStatus'

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
