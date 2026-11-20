import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import {
  cleanupTask6Archive,
  fixtureContext,
  reportBlogEnvironment,
  richText,
  task6ArchiveFixture,
} from './blogFixtures'

const runID = process.env.PLAYWRIGHT_E2E_RUN_ID
const databaseURI = process.env.DATABASE_URI

if (!runID || !databaseURI) {
  throw new Error('PLAYWRIGHT_E2E_RUN_ID and DATABASE_URI are required for the Task 6 archive seed.')
}

if (process.env.DISABLE_R2_STORAGE !== 'true') {
  throw new Error('DISABLE_R2_STORAGE=true is required for the Task 6 archive seed.')
}

reportBlogEnvironment(runID)
const fixture = task6ArchiveFixture(runID)
const payload = await getPayload({ config })

try {
  await cleanupTask6Archive(payload, runID)
  const category = await payload.create({
    collection: 'blog-categories',
    data: { title: fixture.categoryTitle, slug: fixture.categorySlug, _order: 'a8' },
    ...fixtureContext,
  })
  const image = await sharp({
    create: { width: 1200, height: 675, channels: 3, background: '#56816e' },
  })
    .png()
    .toBuffer()
  const heroImage = await payload.create({
    collection: 'media',
    data: { alt: fixture.mediaAlt },
    file: {
      data: image,
      mimetype: 'image/png',
      name: `${fixture.categorySlug}.png`,
      size: image.length,
    },
    ...fixtureContext,
  })

  for (const blog of fixture.blogs) {
    await payload.create({
      collection: 'blogs',
      data: {
        ...blog,
        _status: 'published',
        category: category.id,
        content: richText(`${blog.title} body copy for the static archive fixture.`),
        excerpt: 'Representative copy for the static blog archive card.',
        heroImage: heroImage.id,
      },
      ...fixtureContext,
    })
  }

  const seededBlogs = await payload.count({
    collection: 'blogs',
    overrideAccess: false,
    where: { category: { equals: category.id } },
  })

  if (seededBlogs.totalDocs !== fixture.blogs.length) {
    throw new Error(
      `Expected ${fixture.blogs.length} Task 6 archive blogs, found ${seededBlogs.totalDocs}.`,
    )
  }

  console.log(
    `Task 6 prebuild archive seed: ${seededBlogs.totalDocs} blogs in ${fixture.categorySlug}.`,
  )
} finally {
  await payload.destroy()
}
