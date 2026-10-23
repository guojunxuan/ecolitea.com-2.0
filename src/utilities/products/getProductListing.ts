import { cached, client, toProductCard, visible } from './shared'

export const getProductListing = (categoryId: string, page: number) =>
  cached(
    ['products-list', categoryId, String(page)],
    ['products-list', `product-category-${categoryId}`],
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
        where: visible([{ category: { equals: categoryId } }]),
      })
      return {
        docs: result.docs.map(toProductCard),
        page: result.page ?? page,
        totalPages: result.totalPages,
      }
    },
  )
