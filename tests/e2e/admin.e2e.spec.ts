import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { blogFixture, reportBlogEnvironment } from '../helpers/blogFixtures'
import { normalizeComputedColor } from '../helpers/computedColor'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const baseURL = getE2EBaseURL()
const captureShots = process.env.ADMIN_UI_SCREENSHOTS === 'true'
const shotDirectory = '/tmp/admin-ui-shots'

async function capture(page: Page, name: string) {
  if (!captureShots) return
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `${shotDirectory}/${name}.png`, animations: 'disabled' })
  const surfaces = await page.evaluate(() => {
    const probe = document.createElement('span')
    document.body.append(probe)
    probe.style.backgroundColor = 'var(--color-bg-secondary)'
    const secondary = getComputedStyle(probe).backgroundColor
    probe.style.backgroundColor = 'var(--color-bg-tertiary)'
    const tertiary = getComputedStyle(probe).backgroundColor
    probe.remove()
    const matching: Record<string, string[]> = { [secondary]: [], [tertiary]: [] }
    for (const element of document.body.querySelectorAll('*')) {
      if (!element.getClientRects().length) continue
      const background = getComputedStyle(element).backgroundColor
      if (background === secondary || background === tertiary) {
        const classes = element.getAttribute('class')?.split(' ').slice(0, 3).join('.') ?? ''
        const label = `${element.tagName.toLowerCase()}.${classes}`
        if (!matching[background].includes(label)) matching[background].push(label)
      }
    }
    return matching
  })
  await writeFile(`${shotDirectory}/${name}-surfaces.json`, JSON.stringify(surfaces, null, 2))
}

async function openSidebar(page: Page) {
  const openMenu = page.getByRole('button', { name: 'Open Menu' })
  if (await openMenu.isVisible()) await openMenu.click()
  await expect(page.getByText('Phase4 Test', { exact: true })).toBeInViewport()
}

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    reportBlogEnvironment(process.env.PLAYWRIGHT_E2E_RUN_ID!)
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await page?.context().close()
    await cleanupTestUser()
  })

  test('can navigate to the dashboard and see editor widgets', async () => {
    await page.goto(`${baseURL}/admin`)
    await expect(page).toHaveURL(`${baseURL}/admin`)
    await expect(page.getByRole('region', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent quote requests' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'New product', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'System status' })).toHaveCount(0)
  })

  test('can navigate to list view', async () => {
    await page.goto(`${baseURL}/admin/collections/users`)
    await expect(page).toHaveURL(/\/admin\/collections\/users(\?.*)?$/)
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto(`${baseURL}/admin/collections/pages/create`)
    await expect(page).toHaveURL(/\/admin\/collections\/pages\/[a-zA-Z0-9-_]+/)
    await expect(page.locator('input[name="title"]')).toBeVisible()
  })

  test('shows the neutral login brand and follows the dark theme', async ({ browser }) => {
    const payload = await getPayload({ config })
    const slug = 'site-settings'
    const { siteName, logo, favicon } = await payload.findGlobal({ slug, depth: 0 })
    // The shared fixture configures branding. Model an unsaved brand for this test
    // in the run-scoped database, bypassing required-field validation only here.
    await payload.db.updateGlobal({ slug, data: { siteName: null, logo: null, favicon: null } })
    try {
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 1000 } })
        try {
          const loginPage = await context.newPage()
          await loginPage.goto(`${baseURL}/admin/login`)
          await expect(loginPage.getByText('Admin', { exact: true })).toBeVisible()
          await expect(loginPage.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Admin')
          await expect(loginPage.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Site administration')
          await expect(loginPage.locator('link[rel="icon"][href="/favicon.svg"]')).toHaveCount(1)
          await expect(loginPage.locator('html')).toHaveAttribute('data-theme', colorScheme)
          const color = await loginPage.evaluate(() => {
            const probe = document.createElement('span')
            probe.style.color = 'var(--color-bg-brand)'
            document.body.append(probe)
            const value = getComputedStyle(probe).color
            probe.remove()
            return value
          })
          expect(normalizeComputedColor(color)).toEqual(
            colorScheme === 'dark' ? [10, 132, 255, 1] : [0, 122, 255, 1],
          )
          await capture(loginPage, `login-${colorScheme}`)
          if (colorScheme === 'dark') {
            await login({
              page: loginPage,
              user: { email: 'phase4-admin@example.invalid', password: 'phase4-test-only' },
            })
            await expect(loginPage.getByRole('link', { name: 'Open Site Settings' })).toBeVisible()
          }
        } finally {
          await context.close()
        }
      }
    } finally {
      await payload.db.updateGlobal({ slug, data: { siteName, logo, favicon: favicon ?? null } })
    }
  })

  test('shows the administrator dashboard and the configured login graphic', async ({ browser }) => {
    test.setTimeout(captureShots ? 60_000 : 30_000)
    const schemes = captureShots ? (['light', 'dark'] as const) : (['light'] as const)
    for (const colorScheme of schemes) {
      const context = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 1000 } })
      try {
        const admin = await context.newPage()
        await admin.goto(`${baseURL}/admin/login`)
        await expect(admin.getByRole('img', { name: 'Phase4 test logo' })).toBeVisible()
        await login({ page: admin, user: { email: 'phase4-admin@example.invalid', password: 'phase4-test-only' } })
        await expect(admin.getByRole('heading', { name: 'System status' })).toBeVisible()
        await expect(admin.getByText('Phase4 Test', { exact: true })).toBeVisible()
        await expect(admin.getByRole('region', { name: 'Site setup' })).toHaveCount(0)
        if (!captureShots) continue

        await expect(admin.locator('html')).toHaveAttribute('data-theme', colorScheme)
        await openSidebar(admin)
        await capture(admin, `dashboard-${colorScheme}`)
        await admin.goto(`${baseURL}/admin/collections/blogs`)
        await expect(admin.getByRole('heading', { name: 'Blogs', exact: true })).toBeVisible()
        await openSidebar(admin)
        await capture(admin, `list-${colorScheme}`)

        const fixture = blogFixture(process.env.PLAYWRIGHT_E2E_RUN_ID!)
        const payload = await getPayload({ config })
        const { docs: [blog] } = await payload.find({
          collection: 'blogs', depth: 0, limit: 1, where: { slug: { equals: fixture.slug } },
        })
        await admin.goto(`${baseURL}/admin/collections/blogs/${blog.id}`)
        await expect(admin.getByRole('textbox', { name: 'Title *', exact: true })).toHaveValue(blog.title)
        await openSidebar(admin)
        await capture(admin, `edit-${colorScheme}`)

        const demo = await context.newPage()
        await demo.setContent(readFileSync('.superpowers/brainstorm/89787-1795079269/content/admin-demo-v2.html', 'utf8'))
        await demo.locator(`[data-t="${colorScheme}"]`).click()
        for (const [view, label] of [['dash', 'dashboard'], ['list', 'list'], ['edit', 'edit']]) {
          await demo.locator(`#viewSeg [data-go="${view}"]`).click()
          await demo.screenshot({ path: `${shotDirectory}/demo-${label}-${colorScheme}.png` })
        }
      } finally {
        await context.close()
      }
    }
  })
})
