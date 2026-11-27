import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook } from 'payload'
import type { Document } from '@/payload-types'

export const revalidateProductDownloads: CollectionAfterChangeHook<Document> = async ({
  doc,
  req,
}) => {
  if (req.context.disableRevalidate) return doc

  let page = 1
  while (true) {
    const result = await req.payload.find({
      collection: 'products',
      where: { resources: { in: [doc.id] } },
      depth: 0,
      draft: false,
      select: {},
      limit: 100,
      page,
      overrideAccess: true,
      req,
    })
    for (const product of result.docs) revalidateTag(`product-${product.id}`, { expire: 0 })
    if (!result.hasNextPage) return doc
    page++
  }
}
