import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import type { BlogCategory } from '@/payload-types'

const invalidateCategory = (doc: BlogCategory, previousDoc?: BlogCategory) => {
  for (const category of [doc, previousDoc]) {
    if (category?.slug) revalidatePath(`/blogs/category/${category.slug}`)
  }
  revalidatePath('/blogs')
  revalidatePath('/search')
  revalidateTag(`blog-category-${doc.id}`, 'max')
  revalidateTag('blog-categories', 'max')
  revalidateTag('blogs-list', 'max')
  revalidateTag('blogs-sitemap', 'max')
}

const afterChange: CollectionAfterChangeHook<BlogCategory> = ({ doc, previousDoc, req }) => {
  if (!req.context.disableRevalidate) invalidateCategory(doc, previousDoc)
  return doc
}
const afterDelete: CollectionAfterDeleteHook<BlogCategory> = ({ doc, req }) => {
  if (!req.context.disableRevalidate) invalidateCategory(doc)
  return doc
}

export const BlogCategories: CollectionConfig = {
  slug: 'blog-categories',
  labels: { singular: 'Blog Category', plural: 'Blog Categories' },
  admin: { group: 'Blog', useAsTitle: 'title' },
  orderable: true,
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'slug', useAsSlug: 'title', admin: { position: 'sidebar' } },
    { name: 'description', type: 'textarea' },
    { name: 'blogs', type: 'join', collection: 'blogs', on: 'category' },
  ],
  hooks: { afterChange: [afterChange], afterDelete: [afterDelete] },
}
