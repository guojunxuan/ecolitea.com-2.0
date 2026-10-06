import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import { publicBlogVisibility } from './publicVisibility'

export interface PublicBlogAuthor {
  id: string
  name: string
}

export async function getPublicBlogAuthors(): Promise<PublicBlogAuthor[]> {
  return unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })
      const authors = new Map<string, PublicBlogAuthor>()
      const where = publicBlogVisibility(new Date())
      let page = 1
      let hasNextPage = true
      while (hasNextPage) {
        const blogs = await payload.find({
          collection: 'blogs',
          depth: 0,
          draft: false,
          overrideAccess: false,
          limit: 100,
          page,
          sort: 'id',
          select: { authors: true, populatedAuthors: true },
          where,
        })
        for (const blog of blogs.docs) {
          for (const author of blog.populatedAuthors ?? []) {
            if (author.id && author.name?.trim())
              authors.set(author.id, { id: author.id, name: author.name })
          }
        }
        hasNextPage = blogs.hasNextPage
        page += 1
      }
      return [...authors.values()].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      )
    },
    ['public-blog-authors'],
    { tags: ['blogs-list'], revalidate: 600 },
  )()
}
