import type { Payload } from 'payload'
import type { Blog } from '@/payload-types'
import { publicBlogVisibility } from './publicVisibility'

export async function getRelatedBlogs(
  blog: Blog,
  payload: Payload,
  now = new Date(),
): Promise<Blog[]> {
  const selected: Blog[] = []
  const seen = new Set<string>([blog.id])
  const categoryId = typeof blog.category === 'string' ? blog.category : blog.category?.id
  const manualIds = [
    ...new Set(
      (blog.relatedBlogs ?? [])
        .map((related) => (typeof related === 'string' ? related : related?.id))
        .filter((id): id is string => typeof id === 'string' && id.length > 0 && !seen.has(id)),
    ),
  ]

  if (manualIds.length) {
    // A populated relationship can be stale; fetch current public documents before using its order.
    const { docs } = await payload.find({
      collection: 'blogs',
      depth: 1,
      draft: false,
      limit: manualIds.length,
      overrideAccess: false,
      pagination: false,
      where: {
        and: [publicBlogVisibility(now), { id: { in: manualIds } }, { id: { not_in: [...seen] } }],
      },
    })
    const byId = new Map(docs.map((doc) => [doc.id, doc]))
    for (const id of manualIds) {
      const doc = byId.get(id)
      if (doc && selected.length < 3) {
        selected.push(doc)
        seen.add(doc.id)
      }
    }
  }

  const fill = async (category?: string) => {
    if (selected.length >= 3) return
    const { docs } = await payload.find({
      collection: 'blogs',
      depth: 1,
      draft: false,
      limit: 3 - selected.length,
      overrideAccess: false,
      pagination: false,
      sort: '-publishedAt',
      where: {
        and: [
          publicBlogVisibility(now),
          { id: { not_in: [...seen] } },
          ...(category ? [{ category: { equals: category } }] : []),
        ],
      },
    })
    for (const doc of docs) {
      if (selected.length >= 3) break
      if (!seen.has(doc.id)) {
        selected.push(doc)
        seen.add(doc.id)
      }
    }
  }

  if (categoryId) await fill(categoryId)
  await fill()
  return selected
}
