import type { Payload } from 'payload'
import { readyTranslationFilter } from './getLocalized'
import { fallbackToEnglish } from './pageAccess'
import { publicSourceVisibility } from './publicSourceVisibility'

type ListingCollection = 'blogs' | 'products'

/** Test the whole locale, independently of the requested category, page or query. */
export async function fallbackListingToEnglish(
  collections: ListingCollection[],
  locale: string,
  englishPath: string,
  suppliedPayload?: Payload,
) {
  if (locale === 'en') return
  const payload =
    suppliedPayload ??
    (await (async () => {
      const [{ getPayload }, { default: config }] = await Promise.all([
        import('payload'),
        import('@payload-config'),
      ])
      return getPayload({ config })
    })())
  async function hasContent(language: string) {
    const results = await Promise.all(
      collections.map(async (collection) =>
        payload.find({
          collection,
          draft: false,
          overrideAccess: false,
          depth: 0,
          limit: 1,
          where: {
            and: [
              publicSourceVisibility(collection),
              ...(await readyTranslationFilter(payload, collection, language)),
            ],
          },
        }),
      ),
    )
    return results.some(({ docs }) => docs.length > 0)
  }
  // English listing routes remain available even when their content is empty.
  await fallbackToEnglish(
    (await hasContent(locale)) ? true : null,
    locale,
    englishPath,
    async () => true,
  )
}
