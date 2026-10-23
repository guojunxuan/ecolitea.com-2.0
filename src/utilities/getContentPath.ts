import type { CollectionSlug } from 'payload'
import { productCategoryPath, productPath } from '@/utilities/products/paths'

const contentPrefixes: Partial<Record<CollectionSlug, string>> = {
  pages: '',
  posts: '/posts',
  blogs: '/blogs',
  'blog-categories': '/blogs/category',
  'case-studies': '/case-studies',
}

type ContentPathOptions = { categorySlug?: string | null }

export const getContentPath = (
  relationTo: CollectionSlug,
  slug: string,
  options: ContentPathOptions = {},
): string | null => {
  if (relationTo === 'products') {
    return slug && options.categorySlug ? productPath(options.categorySlug, slug) : null
  }

  if (relationTo === 'product-categories') {
    return slug ? productCategoryPath(slug) : null
  }

  const prefix = contentPrefixes[relationTo]
  return prefix === undefined || !slug ? null : `${prefix}/${encodeURIComponent(slug)}`
}
