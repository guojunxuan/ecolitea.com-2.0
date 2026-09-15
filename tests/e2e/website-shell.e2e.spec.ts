import { expect, type Page, test, type TestInfo } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { getMediaUrl } from '../../src/utilities/getMediaUrl'

const baseURL = getE2EBaseURL()
const E2E_MEDIA_ORIGIN = 'https://media.example.invalid'
const disableRevalidate = { context: { disableRevalidate: true } }
const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
const slugs = {
  direct: `e2e-website-shell-${runID}-direct`,
  main: `e2e-website-shell-${runID}-main`,
  privacy: `e2e-website-shell-${runID}-privacy`,
  route: `e2e-website-shell-${runID}-route`,
  terms: `e2e-website-shell-${runID}-terms`,
} as const
const fixturePath = `/${slugs.main}`
const routePath = `/${slugs.route}`
let payload: Payload
let expectedBrandAssetURL = ''

const customLink = (label: string, url: string) => ({ label, type: 'custom' as const, url })
const unlabeledLink = (url: string) => ({ type: 'custom' as const, url })
const emptyPage = (slug: string, title: string) => ({
  _status: 'published' as const,
  hero: { type: 'none' as const },
  layout: [{ blockType: 'content' as const, columns: [] }],
  slug,
  title,
})

async function deleteFixtures() {
  if (!payload) return
  assertRunScopedE2EDatabaseURI(process.env.DATABASE_URI!, runID)
  await payload.delete({
    collection: 'pages',
    where: { slug: { in: Object.values(slugs) } },
    ...disableRevalidate,
  })
  await payload.delete({
    collection: 'social-platforms',
    where: { platform: { equals: 'E2E LinkedIn' } },
    ...disableRevalidate,
  })
  await payload.delete({
    collection: 'brand-assets',
    where: { alt: { equals: 'E2E website shell logo' } },
    ...disableRevalidate,
  })
  await payload.db.globals.deleteMany({
    globalType: { $in: ['header', 'footer', 'site-settings'] },
  })
}

async function seedFixtures() {
  await deleteFixtures()
  const pages = await Promise.all(
    Object.entries(slugs).map(([key, slug]) =>
      payload.create({
        collection: 'pages',
        data: emptyPage(slug, `E2E ${key} page`),
        ...disableRevalidate,
      }),
    ),
  )
  const bySlug = Object.fromEntries(pages.map((page) => [page.slug, page]))
  const logoSVG = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40"><rect width="180" height="40" rx="8" fill="#111"/><text x="18" y="27" fill="white" font-family="Arial" font-size="18">E2E Company</text></svg>',
  )
  const logo = await payload.create({
    collection: 'brand-assets',
    data: { alt: 'E2E website shell logo' },
    file: {
      data: logoSVG,
      mimetype: 'image/svg+xml',
      name: 'e2e-website-shell-logo.svg',
      size: logoSVG.byteLength,
    },
    ...disableRevalidate,
  })
  const originalBrandAssetURL = `${E2E_MEDIA_ORIGIN}/e2e-website-shell-logo.svg`
  if (logo.url !== originalBrandAssetURL) {
    throw new Error('E2E storage must return the controlled Brand Asset original URL.')
  }
  const social = await payload.create({
    collection: 'social-platforms',
    data: { icon: logo.id, platform: 'E2E LinkedIn' },
    ...disableRevalidate,
  })
  const persistedLogo = await payload.findByID({
    collection: 'brand-assets',
    id: logo.id,
  })
  if (persistedLogo.url !== originalBrandAssetURL) {
    throw new Error('E2E storage must persist the controlled Brand Asset original URL.')
  }
  expectedBrandAssetURL = getMediaUrl(originalBrandAssetURL, persistedLogo.updatedAt)
  const routePage = bySlug[slugs.route]!
  const directPage = bySlug[slugs.direct]!

  const productContent = [
    {
      blockType: 'linkGroup' as const,
      heading: 'Products',
      links: [{ link: customLink('E2E Product overview', '/e2e-product-overview') }],
    },
  ]

  await payload.updateGlobal({
    slug: 'header',
    data: {
      enableMenuCta: true,
      menuCta: customLink('E2E Talk to sales', '/e2e-contact'),
      navItems: [
        {
          label: 'E2E Direct',
          link: { reference: { relationTo: 'pages', value: directPage.id }, type: 'reference' },
          navigationType: 'directLink',
        },
        { content: productContent, label: 'E2E Products', navigationType: 'dropdown' },
        {
          content: productContent,
          label: 'E2E Hybrid Hub',
          link: { reference: { relationTo: 'pages', value: routePage.id }, type: 'reference' },
          navigationType: 'directLinkAndDropdown',
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          label: `E2E Extra Navigation ${index + 1}`,
          link: unlabeledLink(`/e2e-extra-${index + 1}`),
          navigationType: 'directLink' as const,
        })),
      ],
    },
    ...disableRevalidate,
  })
  await payload.updateGlobal({
    slug: 'footer',
    data: {
      columns: ['Products', 'Solutions', 'Resources', 'Company'].map((label, index) => ({
        label: `E2E ${label}`,
        navItems: [{ link: customLink(`E2E ${label} link`, `/e2e-footer-${index + 1}`) }],
      })),
    },
    ...disableRevalidate,
  })
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      address: 'E2E registered business address',
      copyrightText: '© E2E Company. All rights reserved.',
      legalCompanyName: 'E2E Company Limited',
      logo: logo.id,
      logoDark: logo.id,
      newsletter: {
        buttonLabel: 'E2E Subscribe',
        description: 'E2E product updates and practical insights.',
        emailPlaceholder: 'E2E email address',
        enabled: true,
        heading: 'E2E Stay informed',
      },
      phone: '+86 1000 2000',
      privacyPolicyPage: bySlug[slugs.privacy]!.id,
      salesEmail: 'sales-e2e@example.com',
      siteDescription: 'A deterministic B2B website shell fixture.',
      siteName: 'E2E Company',
      socialLinks: [{ platform: social.id, url: 'https://example.com/e2e-linkedin' }],
      tagline: 'Deterministic E2E website shell',
      termsPage: bySlug[slugs.terms]!.id,
    },
    ...disableRevalidate,
  })
}

async function openFixture(page: Page, width: number) {
  const placeholderRequests: string[] = []
  await page.route('https://media.example.invalid/**', async (route) => {
    placeholderRequests.push(route.request().url())
    await route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      contentType: 'image/svg+xml',
    })
  })
  ;(page as Page & { e2ePlaceholderRequests?: string[] }).e2ePlaceholderRequests =
    placeholderRequests
  await page.setViewportSize({ height: width < 768 ? 844 : 960, width })
  await page.goto(`${baseURL}${fixturePath}`)
  await expect(page.locator('header')).toBeVisible()
  await expect(page.locator('main#main-content')).toBeAttached()
  await expect(page.locator('footer')).toBeVisible()
}

async function expectShell(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
  const geometry = await page.evaluate(() => {
    const header = document.querySelector('header')!.getBoundingClientRect()
    const main = document.querySelector('main#main-content')!.getBoundingClientRect()
    const footer = document.querySelector('footer')!.getBoundingClientRect()
    return {
      footerTop: footer.top,
      headerBottom: header.bottom,
      headerHeight: header.height,
      mainBottom: main.bottom,
      mainTop: main.top,
    }
  })
  expect(geometry.headerHeight).toBeGreaterThan(0)
  expect(geometry.mainTop).toBeGreaterThanOrEqual(geometry.headerBottom)
  expect(geometry.footerTop).toBeGreaterThanOrEqual(geometry.mainBottom)
  expect(
    await page
      .locator('header, main#main-content, footer')
      .evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase())),
  ).toEqual(['header', 'main', 'footer'])
}

async function expectThemeInvariant(page: Page) {
  await expect(page.locator('[data-theme]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /(?:theme|dark mode|light mode|auto mode)/i }),
  ).toHaveCount(0)
  const readColors = () =>
    page.evaluate(() =>
      ['body', 'header > div', 'main#main-content', 'footer'].map((selector) => {
        const styles = getComputedStyle(document.querySelector(selector)!)
        return { backgroundColor: styles.backgroundColor, color: styles.color }
      }),
    )
  await page.emulateMedia({ colorScheme: 'light' })
  const light = await readColors()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(readColors).toEqual(light)
}

async function expectNewsletter(page: Page) {
  await expect(page.getByRole('heading', { name: 'E2E Stay informed' })).toBeVisible()
  await expect(page.getByText('E2E product updates and practical insights.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'E2E email address' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'E2E Subscribe' })).toBeDisabled()
}

async function expectFooterIdentityAndContact(page: Page) {
  const brand = page.locator('[data-footer-content="brand"]')
  const logo = brand.getByRole('img', { name: 'E2E website shell logo' })
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('src', expectedBrandAssetURL)
  await expect(logo).not.toHaveAttribute('src', /\/_next\/image/)
  await expect(logo).not.toHaveAttribute('src', /\/cdn-cgi\//)

  const social = page.locator('[data-footer-content="social"]')
  await expect(social.getByRole('link', { name: 'E2E LinkedIn' })).toHaveAttribute(
    'href',
    'https://example.com/e2e-linkedin',
  )
  const socialIcon = social.locator('img')
  await expect(socialIcon).toBeVisible()
  await expect(socialIcon).toHaveAttribute('src', expectedBrandAssetURL)
  await expect(socialIcon).not.toHaveAttribute('src', /\/_next\/image/)
  await expect(socialIcon).not.toHaveAttribute('src', /\/cdn-cgi\//)
  await expect
    .poll(() => (page as Page & { e2ePlaceholderRequests?: string[] }).e2ePlaceholderRequests ?? [])
    .toEqual(expect.arrayContaining([expectedBrandAssetURL]))

  const contact = page.locator('[data-footer-content="contact"]')
  await expect(contact.getByText('E2E registered business address')).toBeVisible()
  await expect(contact.getByRole('link', { name: '+86 1000 2000' })).toHaveAttribute(
    'href',
    'tel:+86 1000 2000',
  )
  await expect(contact.getByRole('link', { name: 'sales-e2e@example.com' })).toHaveAttribute(
    'href',
    'mailto:sales-e2e@example.com',
  )
  await expect(contact.locator('svg')).toHaveCount(3)
  for (const icon of ['map-pin', 'phone', 'mail']) {
    await expect(contact.locator(`.lucide-${icon}`)).toHaveAttribute('aria-hidden', 'true')
  }
}

async function shot(page: Page, testInfo: TestInfo, state: string) {
  await page.screenshot({
    fullPage: state === 'closed',
    path: testInfo.outputPath(`website-shell-${page.viewportSize()?.width}-${state}.png`),
  })
}

async function exerciseMobile(page: Page, testInfo: TestInfo) {
  const openButton = page.getByRole('button', { name: 'Open navigation' })
  const dialog = page.getByRole('dialog', { name: 'Navigation' })
  await openButton.click()
  await expect(dialog).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  const viewport = page.viewportSize()!
  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.x).toBe(0)
  expect(dialogBox!.width).toBe(viewport.width)
  expect(dialogBox!.y).toBeGreaterThan(0)
  expect(dialogBox!.height + dialogBox!.y).toBeCloseTo(viewport.height, 0)

  const products = dialog.getByRole('button', { name: 'Open E2E Products' })
  await products.click()
  await expect(dialog.getByRole('heading', { name: 'E2E Products' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'E2E Product overview' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Back to navigation' })).toBeFocused()
  await shot(page, testInfo, 'mobile-section')
  await dialog.getByRole('button', { name: 'Back to navigation' }).click()
  await expect(products).toBeFocused()

  const first = dialog.locator('a[href], button:not([disabled])').first()
  const last = dialog
    .locator('section:not([inert]) a[href], section:not([inert]) button:not([disabled])')
    .last()
  await first.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(openButton).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await openButton.click()
  await dialog.getByRole('button', { name: 'Close navigation' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await openButton.click()
  await dialog.getByRole('button', { name: 'Open E2E Products' }).click()
  await dialog.getByRole('link', { name: 'E2E Product overview' }).click()
  await expect(page).toHaveURL(`${baseURL}/e2e-product-overview`)
  await expect(dialog).toBeHidden()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
}

async function expectDesktopZones(page: Page) {
  const zoneGroups = [
    [
      page.locator('header .site-container > a'),
      page.getByRole('navigation', { name: 'Primary' }),
      page.getByRole('link', { name: 'Search' }).locator('..'),
    ],
    [
      page.locator('[data-footer-content="brand"]'),
      page.locator('[data-footer-content="navigation"]'),
      page.locator('[data-footer-content="newsletter"]').locator('..'),
    ],
  ]
  for (const zones of zoneGroups) {
    const boxes = await Promise.all(zones.map((zone) => zone.boundingBox()))
    boxes.forEach((box) => expect(box).not.toBeNull())
    expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x)
    expect(boxes[1]!.x + boxes[1]!.width).toBeLessThanOrEqual(boxes[2]!.x)
  }
}

async function exposeDesktopControl(page: Page, name: string) {
  return page.getByRole('button', { name })
}

test.describe.serial('Responsive website shell', () => {
  test.setTimeout(120_000)
  test.beforeAll(async () => {
    payload = await getPayload({ config })
    await seedFixtures()
  })
  test.afterAll(async () => {
    await deleteFixtures()
  })

  for (const width of [390, 834]) {
    test(`${width}px uses shared full-screen three-level navigation`, async ({
      page,
    }, testInfo) => {
      await openFixture(page, width)
      await expectShell(page)
      await expectThemeInvariant(page)
      await expectNewsletter(page)
      await expectFooterIdentityAndContact(page)
      await shot(page, testInfo, 'closed')
      await exerciseMobile(page, testInfo)
      await page.goto(`${baseURL}${fixturePath}`)
      const sections = page.getByRole('navigation', { name: 'Footer' }).locator('section')
      await expect(sections).toHaveCount(4)
      const accordion = sections.first().getByRole('button')
      await expect(accordion).toBeVisible()
      await accordion.click()
      await expect(accordion).toHaveAttribute('aria-expanded', 'true')
    })
  }

  for (const width of [1171, 1440]) {
    test(`${width}px uses three desktop zones and desktop menus`, async ({ page }, testInfo) => {
      await openFixture(page, width)
      await expectShell(page)
      await expectThemeInvariant(page)
      await expectNewsletter(page)
      await expectFooterIdentityAndContact(page)
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden()
      await expectDesktopZones(page)
      await shot(page, testInfo, 'closed')

      const products = await exposeDesktopControl(page, 'E2E Products menu')
      await products.click()
      await expect(page.getByRole('region', { name: 'E2E Products menu' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'E2E Product overview' })).toBeVisible()
      await shot(page, testInfo, 'desktop-mega-menu')
      await page.keyboard.press('Escape')

      const hybridButton = await exposeDesktopControl(page, 'E2E Hybrid Hub menu')
      const before = page.url()
      await hybridButton.click()
      await expect(page).toHaveURL(before)
      await expect(page.getByRole('region', { name: 'E2E Hybrid Hub menu' })).toBeVisible()
      await page.keyboard.press('Escape')
      const hybridLink = page.getByRole('link', { name: 'E2E Hybrid Hub', exact: true })
      await hybridLink.click()
      await expect(page).toHaveURL(`${baseURL}${routePath}`)

      const footer = page.getByRole('navigation', { name: 'Footer' })
      await expect(footer.locator('section')).toHaveCount(4)
      await expect(footer.locator('section').first().getByRole('button')).toBeHidden()
      await expect(footer.locator('section').first().locator('h2')).toBeVisible()
    })
  }
})
