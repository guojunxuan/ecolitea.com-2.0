import { test, expect } from '@playwright/test'
import path from 'node:path'
import {
  cleanupRelatedPosts,
  relatedPostsFixture,
  seedRelatedPosts,
} from '../helpers/seedRelatedPosts'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'

const baseURL = getE2EBaseURL()

test.describe('Frontend', () => {
  test('returns the intentional not-found page at the removed template homepage', async ({
    page,
    request,
  }) => {
    const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
    assertRunScopedE2EDatabaseURI(process.env.DATABASE_URI!, runID)
    console.info(`Homepage absence fixture target: ${process.env.DATABASE_URI}; storage unchanged.`)
    const homes = await request.get(`${baseURL}/api/pages?where[slug][equals]=home&depth=0`)
    expect(homes.ok()).toBe(true)
    const { docs } = await homes.json()
    expect(docs).toHaveLength(1)
    const homepage = docs[0] as { id: string; slug: string; title: string }
    expect(homepage).toMatchObject({ slug: 'home', title: 'Phase3 home' })
    const login = await request.post(`${baseURL}/api/users/login`, {
      data: { email: 'phase4-admin@example.invalid', password: 'phase4-test-only' },
    })
    expect(login.ok()).toBe(true)
    const moveHomepage = async (slug: string) => {
      const update = await request.patch(`${baseURL}/api/pages/${homepage.id}`, {
        headers: { Origin: baseURL },
        data: { slug },
      })
      expect(update.ok(), await update.text()).toBe(true)
      // This fixture changes what '/' resolves to; expire its prebuilt output.
      const invalidation = await request.post(`${baseURL}/next/revalidate`, {
        headers: { Authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
        data: { paths: ['/'] },
      })
      expect(invalidation.status()).toBe(204)
    }
    // Shared language fixtures publish a real CMS homepage. Temporarily move
    // only that document to exercise the missing-home contract, then restore it
    // without unpublishing/deleting its ready translations.
    try {
      await moveHomepage(`e2e-absent-home-${runID}`)
      const response = await page.goto(baseURL)
      expect(response?.status()).toBe(404)
      await expect(page.locator('h1').first()).toHaveText('404')
    } finally {
      await moveHomepage(homepage.slug)
    }
    expect((await page.goto(baseURL))?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Phase3 home', level: 2 })).toBeVisible()
    expect((await request.get(`${baseURL}/de`, { maxRedirects: 0 })).status()).toBe(200)
  })

  test.describe('post detail', () => {
    test.beforeAll(async () => {
      await seedRelatedPosts()
    })

    test.afterAll(async () => {
      await cleanupRelatedPosts()
    })

    test('should render related post cards with their image and category', async ({ page }) => {
      const transformedImageRequests: string[] = []
      await page.route('https://media.example.invalid/**', async (route) => {
        transformedImageRequests.push(route.request().url())
        await route.fulfill({
          contentType: 'image/webp',
          path: path.resolve(process.cwd(), 'tests/fixtures/image-post1.webp'),
        })
      })

      await page.goto(`${baseURL}/posts/${relatedPostsFixture.postSlug}`)

      await expect(page.locator('h1')).toHaveText(relatedPostsFixture.postTitle)

      const postCards = page.locator('article article')

      const relatedCard = postCards.filter({
        has: page.getByRole('link', { name: relatedPostsFixture.relatedPostTitle }),
      })

      await expect(relatedCard).toHaveCount(1)
      await expect(relatedCard.locator('img')).toBeAttached()
      await expect(relatedCard).toContainText(relatedPostsFixture.categoryTitle)

      const image = relatedCard.locator('img')
      await expect(image).toHaveAttribute(
        'src',
        /^https:\/\/media\.example\.invalid\/cdn-cgi\/image\//,
      )
      await expect(image).not.toHaveAttribute('src', /\/_next\/image/)
      await expect(image).not.toHaveAttribute('srcset', /\/_next\/image/)

      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => transformedImageRequests.length).toBeGreaterThan(0)
      expect(transformedImageRequests).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^https:\/\/media\.example\.invalid\/cdn-cgi\/image\//),
        ]),
      )
    })
  })
})
