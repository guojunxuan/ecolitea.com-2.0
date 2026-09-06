import { expect, type Page, test, type TestInfo } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

const baseURL = 'http://localhost:3000'
const disableRevalidate = { context: { disableRevalidate: true } }
const fixtureSlug = `e2e-website-shell-${randomUUID()}`
const fixturePath = `/${fixtureSlug}`

let payload: Payload

async function openFixture(page: Page, width: number) {
  await page.setViewportSize({ height: width < 768 ? 844 : 960, width })
  await page.goto(`${baseURL}${fixturePath}`)
  await expect(page.locator('header')).toBeVisible()
  await expect(page.locator('main#main-content')).toBeAttached()
  await expect(page.locator('footer')).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
}

async function expectShellOrder(page: Page) {
  const order = await page
    .locator('header, main#main-content, footer')
    .evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase()))
  expect(order).toEqual(['header', 'main', 'footer'])
}

async function screenshot(page: Page, testInfo: TestInfo) {
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`website-shell-${page.viewportSize()?.width}.png`),
  })
}

async function exerciseMobileNavigation(page: Page) {
  const openButton = page.getByRole('button', { name: 'Open navigation' })
  await openButton.click()

  const dialog = page.getByRole('dialog', { name: 'Navigation' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-level', '1')
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expect(dialog).toHaveCSS('position', 'fixed')

  const dialogBox = await dialog.boundingBox()
  const viewport = page.viewportSize()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.x).toBe(0)
  expect(dialogBox!.y).toBe(0)
  expect(dialogBox!.width).toBe(viewport!.width)
  expect(dialogBox!.height).toBe(viewport!.height)

  const firstLevelTrigger = dialog.getByRole('button', { name: /^Open / }).first()
  await firstLevelTrigger.click()
  await expect(dialog).toHaveAttribute('data-level', '2')

  // The active level-two panel owns the only accessible drill-down button.
  const accessibleLevelTwoTrigger = dialog.getByRole('button', { name: /^Open / }).first()
  await expect(accessibleLevelTwoTrigger).toBeVisible()
  await accessibleLevelTwoTrigger.click()
  await expect(dialog).toHaveAttribute('data-level', '3')

  const backToLevelTwo = dialog.getByRole('button', { name: /^Back to (?!Navigation)/ })
  await backToLevelTwo.click()
  await expect(dialog).toHaveAttribute('data-level', '2')
  await expect(accessibleLevelTwoTrigger).toBeFocused()

  await dialog.getByRole('button', { name: 'Back to Navigation' }).click()
  await expect(dialog).toHaveAttribute('data-level', '1')
  await expect(firstLevelTrigger).toBeFocused()

  const firstFocusable = dialog.locator('a[href], button:not([disabled])').first()
  const lastFocusable = dialog
    .locator('section:not([inert]) a[href], section:not([inert]) button:not([disabled])')
    .last()
  await firstFocusable.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(lastFocusable).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(firstFocusable).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(openButton).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await openButton.click()
  await dialog.getByRole('button', { name: 'Close navigation' }).click()
  await expect(dialog).toBeHidden()
  await expect(openButton).toBeFocused()

  await openButton.click()
  await dialog.locator('a[href="/"]').first().click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(`${baseURL}/`)

  await page.goto(`${baseURL}${fixturePath}`)
  await expect(openButton).toBeVisible()
}

async function openDesktopMenu(page: Page, label: string) {
  const directTrigger = page.getByRole('button', { name: `${label} menu` })
  if (!(await directTrigger.isVisible())) {
    await page.getByRole('button', { name: 'More menu' }).click()
  }
  await directTrigger.click()
  await expect(page.getByRole('region', { name: `${label} menu` })).toBeVisible()
}

test.describe.serial('Responsive website shell', () => {
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.delete({
      collection: 'pages',
      where: { slug: { equals: fixtureSlug } },
      ...disableRevalidate,
    })
    await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        hero: { type: 'none' },
        layout: [{ blockType: 'content', columns: [] }],
        slug: fixtureSlug,
        title: 'Website shell E2E fixture',
      },
      ...disableRevalidate,
    })
  })

  test.afterAll(async () => {
    await payload.delete({
      collection: 'pages',
      where: { slug: { equals: fixtureSlug } },
      ...disableRevalidate,
    })
  })

  for (const width of [390, 834]) {
    test(`${width}px uses the shared full-screen, three-level navigation`, async ({
      page,
    }, testInfo) => {
      await openFixture(page, width)
      await expectShellOrder(page)
      await expectNoHorizontalOverflow(page)
      await exerciseMobileNavigation(page)

      const footerNavigation = page.getByRole('navigation', { name: 'Footer' })
      const footerSections = footerNavigation.locator('section')
      await expect(footerSections).toHaveCount(4)
      const firstAccordion = footerSections.first().getByRole('button')
      await expect(firstAccordion).toBeVisible()
      await expect(firstAccordion).toHaveAttribute('aria-expanded', 'false')
      await firstAccordion.click()
      await expect(firstAccordion).toHaveAttribute('aria-expanded', 'true')

      await expect(page.getByRole('textbox', { name: 'Email address' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Subscribe' })).toBeDisabled()
      await screenshot(page, testInfo)
    })
  }

  test('1170px uses desktop navigation without overflowing the header', async ({
    page,
  }, testInfo) => {
    await openFixture(page, 1170)
    await expectShellOrder(page)
    await expectNoHorizontalOverflow(page)
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden()
    const moreMenu = page.getByRole('button', { name: 'More menu' })
    if (await moreMenu.isVisible()) {
      await moreMenu.click()
      await expect(page.getByRole('region', { name: 'More menu' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('region', { name: 'More menu' })).toBeHidden()
    } else {
      await expect(page.getByRole('navigation', { name: 'Primary' })).toContainText('Pricing')
    }

    await openDesktopMenu(page, 'Platform')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('region', { name: 'Platform menu' })).toBeHidden()

    const footerNavigation = page.getByRole('navigation', { name: 'Footer' })
    await expect(footerNavigation.locator('section').first().getByRole('button')).toBeHidden()
    await expect(footerNavigation.locator('section').first().locator('h2')).toBeVisible()
    await screenshot(page, testInfo)
  })

  test('1440px exposes desktop mega menus and separate hybrid actions', async ({
    page,
  }, testInfo) => {
    await openFixture(page, 1440)
    await expectShellOrder(page)
    await expectNoHorizontalOverflow(page)

    const platformLink = page.getByRole('link', { name: 'Platform', exact: true })
    const platformMenuButton = page.getByRole('button', { name: 'Platform menu' })
    await expect(platformLink).toBeVisible()
    await expect(platformMenuButton).toBeVisible()
    await expect(platformMenuButton).toHaveAttribute('aria-expanded', 'false')
    await platformMenuButton.click()
    await expect(platformMenuButton).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('region', { name: 'Platform menu' })).toBeVisible()

    await expect(page.locator('[data-theme]')).toHaveCount(0)
    const lightColors = await page.locator('html').evaluate((element) => {
      const styles = getComputedStyle(element)
      return { background: styles.backgroundColor, color: styles.color }
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect
      .poll(() =>
        page.locator('html').evaluate((element) => {
          const styles = getComputedStyle(element)
          return { background: styles.backgroundColor, color: styles.color }
        }),
      )
      .toEqual(lightColors)

    await expect(page.getByRole('textbox', { name: 'Email address' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Subscribe' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await screenshot(page, testInfo)
  })
})
