import { test, expect } from '@playwright/test'
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
      await page.goto(`http://localhost:3000/posts/${relatedPostsFixture.postSlug}`)

      await expect(page.locator('h1')).toHaveText(relatedPostsFixture.postTitle)

      const postCards = page.locator('article article')

      const relatedCard = postCards.filter({
        has: page.getByRole('link', { name: relatedPostsFixture.relatedPostTitle }),
      })

      await expect(relatedCard).toHaveCount(1)
      await expect(relatedCard.locator('img')).toBeAttached()
      await expect(relatedCard).toContainText(relatedPostsFixture.categoryTitle)
    })
  })
})
