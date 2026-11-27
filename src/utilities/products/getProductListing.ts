import { getLocalizedList, readyTranslationFilter } from '../i18n/getLocalized'
import { cached, client, toProductCard, visible } from './shared'

export const getProductListing = (categoryId: string, page: number, locale = 'en') =>
  cached(
    ['products-list', categoryId, String(page), locale],
    ['products-list', `product-category-${categoryId}`, `translations:${locale}`],
    async () => {
      const payload = await client()
      const result = await payload.find({
        collection: 'products',
        depth: 1,
        draft: false,
        overrideAccess: false,
        limit: 12,
        page,
        sort: '-publishedAt',
        where: visible([
          { category: { equals: categoryId } },
          ...(await readyTranslationFilter(payload, 'products', locale)),
        ]),
      })
      return {
        docs: (await getLocalizedList(result.docs, 'products', locale, payload)).map(toProductCard),
        page: result.page ?? page,
        totalPages: result.totalPages,
      }
    },
  )
