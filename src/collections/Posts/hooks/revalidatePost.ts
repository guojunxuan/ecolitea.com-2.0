import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { createRevalidation } from '@/plugins/translation/revalidate'

import type { Post } from '../../../payload-types'

export const revalidatePost: CollectionAfterChangeHook<Post> = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  const cache = createRevalidation()
  const { revalidatePath, revalidateTag } = cache
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      const path = `/posts/${doc.slug}`

      payload.logger.info(`Revalidating post at path: ${path}`)

      revalidatePath(path)
      revalidateTag('posts-sitemap', 'max')
      revalidatePath('/posts')
      revalidatePath('/search')
      revalidateTag('posts', 'max')
    }

    // If the post was previously published, we need to revalidate the old path
    if (previousDoc._status === 'published' && doc._status !== 'published') {
      const oldPath = `/posts/${previousDoc.slug}`

      payload.logger.info(`Revalidating old post at path: ${oldPath}`)

      revalidatePath(oldPath)
      revalidateTag('posts-sitemap', 'max')
      revalidatePath('/posts')
      revalidatePath('/search')
      revalidateTag('posts', 'max')
    }
  }
  await cache.flush()
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Post> = async ({
  doc,
  req: { context },
}) => {
  const cache = createRevalidation()
  const { revalidatePath, revalidateTag } = cache
  if (!context.disableRevalidate) {
    const path = `/posts/${doc?.slug}`

    revalidatePath(path)
    revalidateTag('posts-sitemap', 'max')
    revalidatePath('/posts')
    revalidatePath('/search')
    revalidateTag('posts', 'max')
  }

  await cache.flush()
  return doc
}
