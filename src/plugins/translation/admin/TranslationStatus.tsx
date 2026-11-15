import type { Payload, ServerProps } from 'payload'
import { locales } from '@/i18n/config'

export async function getTranslationStatus(payload: Payload) {
  const usage = await payload.findGlobal({ slug: 'translation-usage', depth: 0 })
  const month = new Date().toISOString().slice(0, 7)
  const counts = await Promise.all(
    locales
      .filter(({ status }) => status !== 'source')
      .map(async ({ code, label }) => {
        const total = (
          await payload.count({ collection: 'translations', where: { locale: { equals: code } } })
        ).totalDocs
        const ready = (
          await payload.count({
            collection: 'translations',
            where: { and: [{ locale: { equals: code } }, { status: { equals: 'ready' } }] },
          })
        ).totalDocs
        return { code, label, ready, total }
      }),
  )
  return { month, characters: usage.month === month ? (usage.characters ?? 0) : 0, counts }
}

/** Documented beforeList server component; ordinary staff share the admin boundary. */
export async function TranslationStatus({ payload, user }: Pick<ServerProps, 'payload' | 'user'>) {
  if (!user) return null
  const summary = await getTranslationStatus(payload)
  return (
    <aside className="translation-status" aria-label="Translation status">
      <p>
        {summary.month}: {summary.characters.toLocaleString('en')} reserved characters.
      </p>
      {summary.counts.length ? (
        <ul>
          {summary.counts.map(({ code, label, ready, total }) => (
            <li key={code}>
              {label}: {ready} / {total} tracked requests ready.
            </li>
          ))}
        </ul>
      ) : (
        <p>No target languages configured.</p>
      )}
    </aside>
  )
}
