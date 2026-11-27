import { test, expect } from '@playwright/test'
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
})
