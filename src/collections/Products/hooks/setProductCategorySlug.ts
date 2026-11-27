import type { CollectionBeforeChangeHook } from 'payload'

const relationshipID = (value: unknown): number | string | null => {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = value.id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

export const setProductCategorySlug: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  // Only category propagation may replace a cached slug for the same relationship.
  if (req.context.setDerivedCategorySlug && typeof data.categorySlug === 'string') return data
  const categoryID = relationshipID(data.category ?? originalDoc?.category)
  const previousCategoryID = relationshipID(originalDoc?.category)
  const previousSlug = originalDoc?.categorySlug

  if (!categoryID) {
    data.categorySlug = null
    return data
  }

  if (categoryID === previousCategoryID && previousSlug) {
    // The cached value is server-owned even when the submitted data includes a forged value.
    data.categorySlug = previousSlug
    return data
  }

  const category = await req.payload.findByID({
    collection: 'product-categories',
    id: categoryID,
    depth: 0,
    req,
  })
  data.categorySlug = category.slug
  return data
}
