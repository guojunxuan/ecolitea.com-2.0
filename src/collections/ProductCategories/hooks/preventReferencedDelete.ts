import { APIError, type CollectionBeforeDeleteHook } from 'payload'

export const preventReferencedDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const references = new Map<string, string>()
  for (const draft of [false, true]) {
    let page = 1
    while (true) {
      const result = await req.payload.find({
        collection: 'products',
        where: { category: { equals: id } },
        draft,
        overrideAccess: true,
        depth: 0,
        limit: 10,
        page,
        req,
      })
      for (const product of result.docs)
        references.set(String(product.id), references.get(String(product.id)) ?? product.title)
      if (!result.hasNextPage) break
      page++
    }
  }
  if (!references.size) return
  const category = await req.payload.findByID({
    collection: 'product-categories',
    id,
    overrideAccess: true,
    depth: 0,
    req,
  })
  const titles = [...references.values()].slice(0, 10)
  throw new APIError(
    `Cannot delete category "${category.title}": ${references.size} products still use it (${titles.join(', ')}). Move or delete them first.`,
    400,
  )
}
