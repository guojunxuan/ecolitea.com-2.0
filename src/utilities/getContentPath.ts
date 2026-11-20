import { localePath } from '@/i18n/paths'
import type { CollectionSlug } from 'payload'
import { productCategoryPath, productPath } from '@/utilities/products/paths'

const contentPrefixes: Partial<Record<CollectionSlug, string>> = {
  pages: '',
  blogs: '/blogs',
  'blog-categories': '/blogs/category',
  'case-studies': '/case-studies',
}

type ContentPathOptions = { categorySlug?: string | null; locale?: string }

export const getContentPath = (
  relationTo: CollectionSlug,
  slug: string,
  options: ContentPathOptions = {},
): string | null => {
  if (relationTo === 'products') {
    return slug && options.categorySlug ? localePath(productPath(options.categorySlug, slug), options.locale) : null
  }

  if (relationTo === 'product-categories') {
    return slug ? localePath(productCategoryPath(slug), options.locale) : null
  }

  const prefix = contentPrefixes[relationTo]
  return prefix === undefined || !slug ? null : localePath(`${prefix}/${encodeURIComponent(slug)}`, options.locale)
}
