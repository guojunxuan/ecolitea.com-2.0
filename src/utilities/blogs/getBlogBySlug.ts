import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import type { Blog } from '@/payload-types'
import { publicBlogVisibility } from './publicVisibility'

export async function getBlogBySlug(slug: string, draft: boolean): Promise<Blog | null> {
  const payload = await getPayload({ config: configPromise })

  if (draft) {
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return null
    const { docs } = await payload.find({
      collection: 'blogs',
      depth: 2,
      draft: true,
      limit: 1,
      overrideAccess: false,
      user,
      pagination: false,
      where: { slug: { equals: slug } },
    })
    return docs[0] ?? null
  }

  // Slug lookup is uncached so a renamed slug disappears immediately. The stable ID keys and tags the full read.
  const { docs: ids } = await payload.find({
    collection: 'blogs',
    depth: 0,
    draft: false,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: {},
    where: { and: [publicBlogVisibility(new Date()), { slug: { equals: slug } }] },
  })
  const id = ids[0]?.id
  if (!id) return null

  const cached = unstable_cache(
    async () => {
      const cachedPayload = await getPayload({ config: configPromise })
      const { docs } = await cachedPayload.find({
        collection: 'blogs',
        depth: 2,
        draft: false,
        limit: 1,
        overrideAccess: false,
        pagination: false,
        where: { and: [publicBlogVisibility(new Date()), { id: { equals: id } }] },
      })
      return docs[0] ?? null
    },
    ['blog-detail', id],
    { tags: [`blog-${id}`, 'blog-categories'], revalidate: 600 },
  )
  return cached()
}
