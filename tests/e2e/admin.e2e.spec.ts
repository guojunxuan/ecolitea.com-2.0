import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { blogFixture, reportBlogEnvironment } from '../helpers/blogFixtures'
import { normalizeComputedColor } from '../helpers/computedColor'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const baseURL = getE2EBaseURL()
const captureShots = process.env.ADMIN_UI_SCREENSHOTS === 'true'
const shotDirectory = '/tmp/themev2-shots'
const demoPath = '.superpowers/brainstorm/16381-1795180738/content/admin-demo-v3.html'

async function capture(page: Page, name: string) {
  if (!captureShots) return
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `${shotDirectory}/${name}.png`, animations: 'disabled' })
}

async function openSidebar(page: Page) {
  const openMenu = page.getByRole('button', { name: 'Open Menu' })
  if (await openMenu.isVisible()) await openMenu.click()
  await expect(page.locator('.nav').getByText('Phase4 Test', { exact: true })).toBeInViewport()
}

// The enhanced layout puts the sidebar on a gray canvas and floats the content as a rounded panel.
async function expectWindowLayout(page: Page) {
  const layout = await page.evaluate(() => {
    // Anonymous callbacks only: tsx injects a __name helper for named functions, which the page lacks.
    const [expectedCanvas, expectedPanel] = ['--admin-canvas', '--color-bg'].map((token) => {
      const probe = document.createElement('span')
      document.body.append(probe)
      probe.style.backgroundColor = `var(${token})`
      const value = getComputedStyle(probe).backgroundColor
      probe.remove()
      return value
    })
    const panel = document.querySelector('.template-default__wrap')!
    const style = getComputedStyle(panel)
    const rect = panel.getBoundingClientRect()
    return {
      canvas: getComputedStyle(document.querySelector('.template-default')!).backgroundColor,
      nav: getComputedStyle(document.querySelector('.nav')!).backgroundColor,
      panel: style.backgroundColor,
      radius: style.borderTopLeftRadius,
      margins: [style.marginTop, style.marginRight, style.marginBottom],
      gapRight: document.documentElement.clientWidth - rect.right,
      gapTop: rect.top,
      expected: { canvas: expectedCanvas, panel: expectedPanel },
    }
  })
  expect(layout.canvas).toBe(layout.expected.canvas)
  expect(layout.panel).toBe(layout.expected.panel)
  expect(layout.canvas).not.toBe(layout.panel)
  expect(layout.nav).toBe('rgba(0, 0, 0, 0)')
  expect(layout.radius).toBe('14px')
  expect(layout.margins).toEqual(['8px', '8px', '8px'])
  // The panel must end 8px before the viewport edge, not overflow it.
  expect(layout.gapRight).toBe(8)
  expect(layout.gapTop).toBe(8)
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
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Overview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent quote requests' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Content activity' })).toBeVisible()
    // "New product" is offered once, as the title-row button, not again in quick actions.
    await expect(page.getByRole('link', { name: 'New product', exact: true })).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'New blog' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'System status' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Translations' })).toHaveCount(0)
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
    const { siteName, logo, favicon } = await payload.findGlobal({ slug, depth: 0, overrideAccess: true })
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
          await expect(loginPage.locator('link[rel="icon"][href="/api/admin-icon"]')).toHaveCount(1)
          const icon = await context.request.get(`${baseURL}/api/admin-icon`, { maxRedirects: 0 })
          expect(icon.status()).toBe(302)
          expect(icon.headers()['location']).toBe('/favicon.svg')
          expect(icon.headers()['cache-control']).toBe('no-store')
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

  test('redirects the public admin icon to the current Site Settings asset', async ({ request }) => {
    const payload = await getPayload({ config })
    const slug = 'site-settings'
    const { favicon, logo } = await payload.findGlobal({ slug, depth: 1, overrideAccess: true })
    if (!logo || typeof logo !== 'object' || !logo.url) throw new Error('Missing logo fixture')

    await payload.db.updateGlobal({ slug, data: { favicon: logo.id } })
    try {
      const icon = await request.get(`${baseURL}/api/admin-icon`, { maxRedirects: 0 })
      const asset = new URL(logo.url, baseURL)
      const location = new URL(icon.headers()['location']!, baseURL)
      expect(icon.status()).toBe(302)
      expect(location.pathname).toBe(asset.pathname)
      expect(location.search).toBe(`?${encodeURIComponent(logo.updatedAt)}`)
      expect(icon.headers()['cache-control']).toBe('no-store')
      expect(await icon.text()).toBe('')
    } finally {
      const previous = typeof favicon === 'object' ? favicon?.id : favicon
      await payload.db.updateGlobal({ slug, data: { favicon: previous ?? null } })
    }
  })

  test('shows the administrator dashboard and the configured login graphic', async ({ browser }) => {
    test.setTimeout(captureShots ? 60_000 : 30_000)
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 1000 } })
      try {
        const admin = await context.newPage()
        await admin.goto(`${baseURL}/admin/login`)
        await expect(admin.getByRole('img', { name: 'Phase4 test logo' })).toBeVisible()
        await login({ page: admin, user: { email: 'phase4-admin@example.invalid', password: 'phase4-test-only' } })
        await expect(admin.getByRole('heading', { name: 'System status' })).toBeVisible()
        await expect(admin.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
        await expect(admin.locator('[data-site-name]')).toHaveText('Phase4 Test')
        await expect(admin.getByRole('region', { name: 'Translations' })).toBeVisible()
        await expect(admin.getByRole('region', { name: 'Content activity' })).toBeVisible()
        await expect(admin.getByRole('region', { name: 'Site setup' })).toHaveCount(0)
        await expect(admin.locator('html')).toHaveAttribute('data-theme', colorScheme)
        await openSidebar(admin)
        await expectWindowLayout(admin)
        // Payload's own account menu shows the user; the theme adds no sidebar user card.
        await expect(admin.locator('.nav').getByRole('link', { name: /Administrator/ })).toHaveCount(0)
        // The native account menu sits in the top bar, and the sidebar copy is hidden.
        await expect(admin.locator('.app-header .user-menu')).toBeVisible()
        // The top bar shows Payload's avatar on the menu button, not the username.
        const trigger = admin.locator('.app-header .user-menu').getByRole('button', { name: 'Account' })
        await expect(trigger).toBeVisible()
        await expect(trigger).toHaveText('')
        const avatar = admin.locator('.app-header .admin-account-menu__avatar')
        await expect(avatar.locator('svg, img').first()).toBeVisible()
        const [avatarBox, triggerBox] = await Promise.all([avatar.boundingBox(), trigger.boundingBox()])
        expect(avatarBox!.x).toBeGreaterThanOrEqual(triggerBox!.x)
        expect(avatarBox!.x + avatarBox!.width).toBeLessThanOrEqual(triggerBox!.x + triggerBox!.width)
        // Only the avatar shows: Payload's chevron icon is hidden.
        await expect(trigger.locator('.btn__icon')).toBeHidden()
        await expect(admin.locator('.nav .user-menu')).toBeHidden()
        await admin.locator('.app-header .user-menu').getByRole('button').first().click()
        await expect(admin.getByRole('menuitem', { name: 'Log out' })).toBeVisible()
        await admin.keyboard.press('Escape')
        if (!captureShots) continue
        await capture(admin, `dashboard-${colorScheme}`)
        await admin.goto(`${baseURL}/admin/collections/blogs`)
        await expect(admin.getByRole('heading', { name: 'Blogs', exact: true })).toBeVisible()
        await openSidebar(admin)
        await capture(admin, `list-${colorScheme}`)

        const fixture = blogFixture(process.env.PLAYWRIGHT_E2E_RUN_ID!)
        const payload = await getPayload({ config })
        const { docs: [blog] } = await payload.find({
          collection: 'blogs', depth: 0, limit: 1, where: { slug: { equals: fixture.slug } },
          overrideAccess: true,
        })
        await admin.goto(`${baseURL}/admin/collections/blogs/${blog.id}`)
        // Payload 4 beta.10 no longer includes the required marker in the field's accessible name.
        await expect(admin.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(blog.title)
        await openSidebar(admin)
        await capture(admin, `edit-${colorScheme}`)

        const demo = await context.newPage()
        await demo.setContent(readFileSync(demoPath, 'utf8'))
        await demo.locator(`#st [data-t="${colorScheme}"]`).click()
        for (const [view, label] of [['dash', 'dashboard'], ['list', 'list'], ['edit', 'edit']]) {
          await demo.locator(`#sv [data-go="${view}"]`).click()
          await demo.screenshot({ path: `${shotDirectory}/demo-${label}-${colorScheme}.png` })
        }
      } finally {
        await context.close()
      }
    }
  })

  test('opens Payload’s command palette from the sidebar without a second search', async () => {
    await page.goto(`${baseURL}/admin`)
    await openSidebar(page)
    const palette = page.getByRole('combobox')
    await expect(palette).toHaveCount(0)

    // The sidebar entry opens the native palette and jumps to a collection.
    await page.locator('.nav button[aria-haspopup="dialog"]').click()
    await expect(palette).toBeVisible()
    await palette.fill('Blogs')
    await page.getByRole('option', { name: /Blogs/ }).first().click()
    await expect(page).toHaveURL(/\/admin\/collections\/blogs(\?.*)?$/)

    // The native Ctrl/Cmd+K shortcut still works and is not shadowed by the sidebar.
    await page.keyboard.press('Control+K')
    await expect(palette).toBeVisible()
    await expect(palette).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0)
  })
})
