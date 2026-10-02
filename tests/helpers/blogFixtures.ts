import type { Payload } from 'payload'
import { assertRunScopedE2EDatabaseURI } from './e2eDatabase'

export const blogFixture = (runID: string) => ({
  prefix: `e2e-blogs-${runID}`,
  slug: `e2e-blogs-${runID}-article`,
  email: `blogs-${runID}@example.invalid`,
  password: 'e2e-blog-preview-only',
  longHeading: `Unbroken${'Tea'.repeat(50)}`,
})
export const fixtureContext = { context: { disableRevalidate: true } }
export const richText = (value: string, heading?: string) =>
  ({
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      children: [
        ...(heading
          ? [
              {
                type: 'heading',
                tag: 'h2',
                version: 1,
                direction: 'ltr',
                format: '',
                indent: 0,
                children: [
                  {
                    type: 'text',
                    version: 1,
                    text: heading,
                    format: 0,
                    detail: 0,
                    mode: 'normal',
                    style: '',
                  },
                ],
              },
            ]
          : []),
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              text: value,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }) as never

export function reportBlogEnvironment(runID: string) {
  const uri = process.env.DATABASE_URI!
  assertRunScopedE2EDatabaseURI(uri, runID)
  const target = new URL(uri)
  if (!['127.0.0.1', 'localhost'].includes(target.hostname))
    throw new Error('Blog fixtures require local MongoDB')
  console.info(
    `Blog fixture target: ${target.host}${target.pathname}; DISABLE_R2_STORAGE=${process.env.DISABLE_R2_STORAGE}; local test files only`,
  )
}

export async function cleanupBlogs(payload: Payload, runID: string) {
  reportBlogEnvironment(runID)
  const { prefix, email } = blogFixture(runID)
  const blogs = await payload.find({
    collection: 'blogs',
    limit: 100,
    depth: 0,
    where: {
      slug: {
        in: [
          `${prefix}-article`,
          `${prefix}-draft`,
          `${prefix}-future`,
          ...Array.from({ length: 13 }, (_, index) => `${prefix}-${index + 1}`),
        ],
      },
    },
  })
  const categories = await payload.find({
    collection: 'blog-categories',
    limit: 100,
    where: { slug: { in: ['brewing', 'sourcing', 'culture'].map((slug) => `${prefix}-${slug}`) } },
  })
  const users = await payload.find({ collection: 'users', where: { email: { equals: email } } })
  const media = await payload.find({
    collection: 'media',
    where: { alt: { equals: `${prefix} photograph` } },
  })
  const ids = blogs.docs.map(({ id }) => id)
  const ownedIDs = [
    ...ids,
    ...categories.docs.map(({ id }) => id),
    ...users.docs.map(({ id }) => id),
    ...media.docs.map(({ id }) => id),
  ]
  for (const collection of ['pages', 'case-studies', 'posts', 'blogs', 'redirects'] as const) {
    for (let page = 1; ; page++) {
      const result = await payload.find({ collection, page, limit: 100, depth: 0, draft: true })
      for (const doc of result.docs) {
        if (!ownedIDs.includes(doc.id) && ownedIDs.some((id) => JSON.stringify(doc).includes(id))) {
          throw new Error(`Fixture referenced by ${collection}/${doc.id}; refusing cleanup`)
        }
      }
      if (!result.hasNextPage) break
    }
  }
  // Refuse to remove content referenced outside this fixture.
  const external = await payload.find({
    collection: 'blogs',
    depth: 0,
    limit: 1,
    where: { and: [{ id: { not_in: ids } }, { relatedBlogs: { in: ids } }] },
  })
  if (external.totalDocs)
    throw new Error(`Fixture referenced by Blogs: ${external.docs.map(({ id }) => id).join(', ')}`)
  const references = await Promise.all(
    (['header', 'footer'] as const).map((slug) => payload.findGlobal({ slug, depth: 0 })),
  )
  for (const reference of references) {
    if (ownedIDs.some((id) => JSON.stringify(reference).includes(id)))
      throw new Error('Fixture referenced by navigation')
  }
  // Delete dependents before their category/media/user. Only exact IDs discovered under the run prefix.
  for (const blog of blogs.docs)
    await payload.delete({ collection: 'blogs', id: blog.id, ...fixtureContext })
  for (const category of categories.docs) {
    const refs = await payload.count({
      collection: 'blogs',
      where: { category: { equals: category.id } },
    })
    if (refs.totalDocs) throw new Error(`Category ${category.id} remains referenced`)
    await payload.delete({ collection: 'blog-categories', id: category.id, ...fixtureContext })
  }
  for (const user of users.docs)
    await payload.delete({ collection: 'users', id: user.id, ...fixtureContext })
  // Media cleanup is handled by Payload after all fixture dependents have gone.
  for (const item of media.docs) {
    const refs = await payload.count({
      collection: 'blogs',
      where: { heroImage: { equals: item.id } },
    })
    if (refs.totalDocs) throw new Error(`Media ${item.id} remains referenced`)
    await payload.delete({ collection: 'media', id: item.id, ...fixtureContext })
  }
}
