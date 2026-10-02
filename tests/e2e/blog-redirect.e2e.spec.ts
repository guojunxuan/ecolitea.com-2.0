import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
const slug = `e2e-blog-redirect-${runID}`
const legacyPath = `/blogs/old-${slug}`

test('Blog reference redirects with HTTP 308 and its public location', async ({ request }) => {
  test.fail(true, 'The existing PayloadRedirects path emits duplicate Location headers for 307 and 308 redirects')
  assertRunScopedE2EDatabaseURI(process.env.DATABASE_URI!, runID)
  console.info(`Blog redirect fixture database: ${process.env.DATABASE_URI}; storage: ${process.env.R2_ENDPOINT}`)

  const payload = await getPayload({ config })
  const imageData = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } })
    .png().toBuffer()
  const media = await payload.create({
    collection: 'media',
    data: { alt: `Blog redirect ${runID}` },
    file: { data: imageData, mimetype: 'image/png', name: `${slug}.png`, size: imageData.length },
    context: { disableRevalidate: true },
  })
  const category = await payload.create({
    collection: 'blog-categories',
    data: { title: `Redirect ${runID}`, slug: `redirect-${runID}` },
    context: { disableRevalidate: true },
  })

  let blogID: string | undefined
  let redirectID: string | undefined
  try {
    const blog = await payload.create({
      collection: 'blogs',
      data: {
        title: `Blog redirect ${runID}`,
        slug,
        excerpt: 'A redirect fixture',
        heroImage: media.id,
        category: category.id,
        content: [{
          blockType: 'prose',
          content: {
            root: {
              type: 'root', version: 1, direction: null, format: '', indent: 0,
              children: [{
                type: 'paragraph', version: 1, direction: null, format: '', indent: 0, textFormat: 0, textStyle: '',
                children: [{ type: 'text', version: 1, text: 'Fixture', format: 0, detail: 0, mode: 'normal', style: '' }],
              }],
            },
          },
        }],
        _status: 'published',
      },
      context: { disableRevalidate: true },
    })
    blogID = blog.id
    const redirect = await payload.create({
      collection: 'redirects',
      data: { from: legacyPath, to: { type: 'reference', reference: { relationTo: 'blogs', value: blog.id } } },
      context: { disableRevalidate: true },
    })
    redirectID = redirect.id

    const response = await request.get(`${getE2EBaseURL()}${legacyPath}`, { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    const locations = response.headersArray().filter(({ name }) => name.toLowerCase() === 'location')
    expect(locations).toEqual([{ name: 'location', value: `/blogs/${slug}` }])
  } finally {
    if (redirectID) await payload.delete({ collection: 'redirects', id: redirectID, context: { disableRevalidate: true } })
    if (blogID) await payload.delete({ collection: 'blogs', id: blogID, context: { disableRevalidate: true } })
    await payload.delete({ collection: 'blog-categories', id: category.id, context: { disableRevalidate: true } })
    await payload.delete({ collection: 'media', id: media.id, context: { disableRevalidate: true } })
  }
})
