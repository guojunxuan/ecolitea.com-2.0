import type { PopulateType } from 'payload'
import { headers } from 'next/headers'
import type { ProductDetail } from './models'
import { cached, client, toProductDetail, visible } from './shared'

export const productDetailPopulate: PopulateType = {
  media: {
    alt: true,
    url: true,
    thumbnailURL: true,
    filename: true,
    mimeType: true,
    filesize: true,
    width: true,
    height: true,
    focalX: true,
    focalY: true,
    createdAt: true,
    updatedAt: true,
  },
  'product-categories': { title: true, slug: true, description: true, image: true, meta: true },
  products: { slug: true, categorySlug: true },
}

export async function getProductBySlug(
  slug: string,
  { draft = false }: { draft?: boolean } = {},
): Promise<ProductDetail | null> {
  if (draft) {
    const payload = await client()
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return null
    const result = await payload.find({
      collection: 'products',
      depth: 2,
      populate: productDetailPopulate,
      draft: true,
      overrideAccess: false,
      user,
      limit: 1,
      where: { slug: { equals: slug } },
    })
    return result.docs[0] ? toProductDetail(result.docs[0]) : null
  }
  // Resolve the current slug before caching by stable ID, as in Blogs.
  const lookupPayload = await client()
  const lookup = await lookupPayload.find({
    collection: 'products',
    depth: 0,
    draft: false,
    overrideAccess: false,
    limit: 1,
    select: {},
    where: visible([{ slug: { equals: slug } }]),
  })
  const id = lookup.docs[0]?.id
  if (!id) return null
  return cached(
    ['product-detail', id],
    [`product-${id}`, 'products-list', 'product-categories'],
    async () => {
      const payload = await client()
      const result = await payload.find({
        collection: 'products',
        depth: 2,
        populate: productDetailPopulate,
        draft: false,
        overrideAccess: false,
        limit: 1,
        where: visible([{ id: { equals: id } }]),
      })
      return result.docs[0] ? toProductDetail(result.docs[0]) : null
    },
  )
}
