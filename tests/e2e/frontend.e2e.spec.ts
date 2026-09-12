import { test, expect } from '@playwright/test'
import path from 'node:path'
import {
  cleanupRelatedPosts,
  relatedPostsFixture,
  seedRelatedPosts,
} from '../helpers/seedRelatedPosts'

test.describe('Frontend', () => {
  test('returns the intentional not-found page at the removed template homepage', async ({
    page,
  }) => {
    const response = await page.goto('http://localhost:3000')
    expect(response?.status()).toBe(404)
    const heading = page.locator('h1').first()
    await expect(heading).toHaveText('404')
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

      await page.goto(`http://localhost:3000/posts/${relatedPostsFixture.postSlug}`)

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
