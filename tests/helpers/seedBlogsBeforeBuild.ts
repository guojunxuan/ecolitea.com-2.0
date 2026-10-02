import { getPayload } from 'payload'
import sharp from 'sharp'
import config from '../../src/payload.config.js'
import { blogFixture, fixtureContext, reportBlogEnvironment, richText } from './blogFixtures'

const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
reportBlogEnvironment(runID)
if (process.env.DISABLE_R2_STORAGE !== 'true')
  throw new Error('Blog prebuild fixtures require DISABLE_R2_STORAGE=true')
const fixture = blogFixture(runID)
const payload = await getPayload({ config })
try {
  const existing = await payload.count({
    collection: 'blogs',
    where: { slug: { contains: fixture.prefix } },
  })
  if (existing.totalDocs)
    throw new Error('Refusing to overwrite existing Blog fixtures; use a fresh run ID')
  const image = await sharp({
    create: { width: 1200, height: 675, channels: 3, background: '#78927b' },
  })
    .png()
    .toBuffer()
  const media = await payload.create({
    collection: 'media',
    data: { alt: `${fixture.prefix} photograph` },
    file: { data: image, mimetype: 'image/png', name: `${fixture.prefix}.png`, size: image.length },
    ...fixtureContext,
  })
  const author = await payload.create({
    collection: 'users',
    data: { email: fixture.email, password: fixture.password, name: 'Tea Editor' },
    ...fixtureContext,
  })
  // Three populated categories make the mobile More disclosure a real browser path.
  const categories = []
  for (const [index, title] of ['Brewing', 'Sourcing', 'Culture'].entries()) {
    categories.push(
      await payload.create({
        collection: 'blog-categories',
        data: {
          title,
          slug: `${fixture.prefix}-${title.toLowerCase()}`,
          description: `${title} notes and guides`,
          _order: `a${index}`,
        },
        ...fixtureContext,
      }),
    )
  }
  const blogs = []
  for (let index = 0; index < 13; index++) {
    blogs.push(
      await payload.create({
        collection: 'blogs',
        data: {
          title: `Tea journal ${String(index + 1).padStart(2, '0')}`,
          slug: `${fixture.prefix}-${index + 1}`,
          excerpt: 'Thoughtful tea stories, field notes, and practical brewing guides.',
          heroImage: media.id,
          category: categories[index < 11 ? 0 : index === 11 ? 1 : 2].id,
          content: [
            { blockType: 'prose', content: richText('A short tea story without headings.') },
          ],
          publishedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
          _status: 'published',
        },
        ...fixtureContext,
      }),
    )
  }
  await payload.create({
    collection: 'blogs',
    data: {
      title: 'The art of brewing thoughtful tea',
      slug: fixture.slug,
      excerpt: 'Explore the leaf, the water, and the ritual.',
      heroImage: media.id,
      category: categories[0].id,
      authors: [author.id],
      relatedBlogs: [blogs[4].id, blogs[1].id, blogs[9].id],
      _status: 'published',
      publishedAt: '2025-06-01T12:00:00.000Z',
      content: [
        {
          blockType: 'prose',
          content: richText(
            'Choose fresh leaves and clean water for a balanced cup.',
            'Start with the leaf',
          ),
        },
        {
          blockType: 'keyTakeaways',
          label: 'At a Glance',
          content: richText('Water temperature changes flavor.'),
        },
        {
          blockType: 'mediaBlock',
          media: media.id,
          caption: richText('Leaves ready for brewing'),
          width: 'wide',
        },
        {
          blockType: 'prose',
          content: richText('Give the leaves room to unfurl.', fixture.longHeading),
        },
        {
          blockType: 'banner',
          style: 'info',
          title: 'Brewing note',
          content: richText('Taste before adding more time.'),
        },
        {
          blockType: 'cta',
          heading: 'Find your next cup',
          description: richText('Discover the full tea collection.'),
          media: media.id,
          links: [
            {
              link: {
                type: 'custom',
                url: '/blogs',
                label: 'Explore tea stories',
                appearance: 'default',
              },
            },
          ],
        },
      ],
    },
    ...fixtureContext,
  })
  for (const status of ['draft', 'future'] as const) {
    await payload.create({
      collection: 'blogs',
      data: {
        title: `${status} private tea story`,
        slug: `${fixture.prefix}-${status}`,
        excerpt: 'Not public yet',
        heroImage: media.id,
        category: categories[0].id,
        content: [{ blockType: 'prose', content: richText('Unpublished editorial copy.') }],
        _status: status === 'draft' ? 'draft' : 'published',
        publishedAt: status === 'future' ? '2999-01-01T00:00:00.000Z' : undefined,
      },
      ...fixtureContext,
    })
  }
  console.info(
    'Blog prebuild fixtures: 14 visible articles, draft, future, three categories, all five blocks, ordered related picks.',
  )
} finally {
  await payload.destroy()
}
