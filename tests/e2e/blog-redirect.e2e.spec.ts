import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { blogFixture } from '../helpers/blogFixtures'

const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
const slug = `e2e-blog-redirect-${runID}`
const legacyPath = `/blogs/old-${slug}`
const destination = `/blogs/${slug}`

test.describe.serial('Blog reference redirect', () => {
  let payload: Payload
  let mediaID: string | undefined
  let categoryID: string | undefined
  let blogID: string | undefined
  let redirectID: string | undefined
  let firstResponseLocations: { name: string; value: string }[] = []

  test.beforeAll(async () => {
    assertRunScopedE2EDatabaseURI(process.env.DATABASE_URI!, runID)
    console.info(
      `Blog redirect fixture database: ${process.env.DATABASE_URI}; storage: ${process.env.R2_ENDPOINT}`,
    )

    payload = await getPayload({ config })
    const imageData = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    const media = await payload.create({
      collection: 'media',
      data: { alt: `Blog redirect ${runID}` },
      file: { data: imageData, mimetype: 'image/png', name: `${slug}.png`, size: imageData.length },
      context: { disableRevalidate: true },
    })
    mediaID = media.id
    const category = await payload.create({
      collection: 'blog-categories',
      data: { title: `Redirect ${runID}`, slug: `redirect-${runID}` },
      context: { disableRevalidate: true },
    })
    categoryID = category.id
    const blog = await payload.create({
      collection: 'blogs',
      data: {
        title: `Blog redirect ${runID}`,
        slug,
        excerpt: 'A redirect fixture',
        heroImage: media.id,
        category: category.id,
        content: [
          {
            blockType: 'prose',
            content: {
              root: {
                type: 'root',
                version: 1,
                direction: null,
                format: '',
                indent: 0,
                children: [
                  {
                    type: 'paragraph',
                    version: 1,
                    direction: null,
                    format: '',
                    indent: 0,
                    textFormat: 0,
                    textStyle: '',
                    children: [
                      {
                        type: 'text',
                        version: 1,
                        text: 'Fixture',
                        format: 0,
                        detail: 0,
                        mode: 'normal',
                        style: '',
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
        _status: 'published',
      },
      context: { disableRevalidate: true },
    })
    blogID = blog.id
    const redirect = await payload.create({
      collection: 'redirects',
      data: {
        from: legacyPath,
        to: { type: 'reference', reference: { relationTo: 'blogs', value: blog.id } },
      },
      context: { disableRevalidate: true },
    })
    redirectID = redirect.id
  })

  test.afterAll(async () => {
    if (!payload) return
    if (redirectID)
      await payload.delete({
        collection: 'redirects',
        id: redirectID,
        context: { disableRevalidate: true },
      })
    if (blogID)
      await payload.delete({
        collection: 'blogs',
        id: blogID,
        context: { disableRevalidate: true },
      })
    if (categoryID)
      await payload.delete({
        collection: 'blog-categories',
        id: categoryID,
        context: { disableRevalidate: true },
      })
    if (mediaID)
      await payload.delete({
        collection: 'media',
        id: mediaID,
        context: { disableRevalidate: true },
      })
  })

  test('returns HTTP 308 with the correct public destination', async ({ request }) => {
    const response = await request.get(`${getE2EBaseURL()}${legacyPath}`, { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    firstResponseLocations = response
      .headersArray()
      .filter(({ name }) => name.toLowerCase() === 'location')
    expect(firstResponseLocations.length).toBeGreaterThan(0)
    expect(firstResponseLocations.every(({ value }) => value === destination)).toBe(true)
  })

  test('has exactly one raw Location header', () => {
    test.fail(
      firstResponseLocations.length === 2 &&
        firstResponseLocations.every(({ value }) => value === destination),
      'The existing PayloadRedirects path sometimes emits two identical Location headers for 307 and 308 redirects',
    )
    expect(firstResponseLocations).toEqual([{ name: 'location', value: destination }])
  })

  test('a warm redirect cache follows a renamed Blog slug', async ({ request, playwright }) => {
    if (!blogID) throw new Error('Missing Blog fixture')
    const editor = await playwright.request.newContext({ baseURL: getE2EBaseURL() })
    try {
      const fixture = blogFixture(runID)
      const login = await editor.post('/api/users/login', {
        data: { email: fixture.email, password: fixture.password },
      })
      expect(login.status()).toBe(200)
      // Exercise the normal Admin write and its cache hooks in the Next server.
      const update = await editor.patch(`/api/blogs/${blogID}`, {
        data: { slug: `${slug}-renamed` },
      })
      expect(update.status()).toBe(200)
      expect((await update.json()).doc.slug).toBe(`${slug}-renamed`)
    } finally {
      await editor.dispose()
    }
    const response = await request.get(`${getE2EBaseURL()}${legacyPath}`, { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    const locations = response
      .headersArray()
      .filter(({ name }) => name.toLowerCase() === 'location')
    expect(locations.length).toBeGreaterThan(0)
    expect(locations.map(({ value }) => value)).toEqual(
      Array(locations.length).fill(`${destination}-renamed`),
    )
    expect((await request.get(`${getE2EBaseURL()}${destination}-renamed`)).status()).toBe(200)
  })

  test('search links follow category rename and disappear after deletion', async ({ page }) => {
    if (!categoryID) throw new Error('Missing category fixture')
    const searchURL = `${getE2EBaseURL()}/search?q=${encodeURIComponent(slug)}`
    await page.goto(searchURL)
    await expect(
      page.getByRole('link', { name: `Redirect ${runID}`, exact: true }),
    ).toHaveAttribute('href', `/blogs/category/redirect-${runID}`)
    await payload.update({
      collection: 'blog-categories',
      id: categoryID,
      data: { title: `Renamed ${runID}`, slug: `renamed-${runID}` },
      context: { disableRevalidate: true },
    })
    await page.goto(searchURL)
    await expect(page.getByRole('link', { name: `Renamed ${runID}`, exact: true })).toHaveAttribute(
      'href',
      `/blogs/category/renamed-${runID}`,
    )
    await payload.delete({
      collection: 'blog-categories',
      id: categoryID,
      context: { disableRevalidate: true },
    })
    categoryID = undefined
    await page.goto(searchURL)
    await expect(page.getByRole('link', { name: `Renamed ${runID}`, exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: `Blog redirect ${runID}`, exact: true }),
    ).toHaveAttribute('href', `${destination}-renamed`)
  })
})
