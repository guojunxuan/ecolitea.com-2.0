import type { CollectionSlug } from 'payload'

const contentPrefixes: Partial<Record<CollectionSlug, string>> = {
  pages: '',
  posts: '/posts',
  blogs: '/blogs',
  'blog-categories': '/blogs/category',
  'case-studies': '/case-studies',
}

export const getContentPath = (relationTo: CollectionSlug, slug: string): string | null => {
  const prefix = contentPrefixes[relationTo]
  return prefix === undefined || !slug ? null : `${prefix}/${encodeURIComponent(slug)}`
}
