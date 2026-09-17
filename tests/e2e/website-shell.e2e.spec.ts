import { expect, type Page, test, type TestInfo } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'
import { getMediaUrl } from '../../src/utilities/getMediaUrl'

const baseURL = getE2EBaseURL()
const E2E_MEDIA_ORIGIN = 'https://media.example.invalid'
const NAVIGATION_IMAGE_ALT_PREFIX = 'E2E website shell navigation image'
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
const navigationImagePNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
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
  await payload.delete({
    collection: 'media',
    where: { alt: { like: NAVIGATION_IMAGE_ALT_PREFIX } },
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

  const media = await Promise.all(
    Array.from({ length: 8 }, async (_, index) => {
      const image = await payload.create({
        collection: 'media',
        data: { alt: `${NAVIGATION_IMAGE_ALT_PREFIX} ${index + 1}` },
        file: {
          data: navigationImagePNG,
          mimetype: 'image/png',
          name: `e2e-navigation-${index + 1}.png`,
          size: navigationImagePNG.byteLength,
        },
        ...disableRevalidate,
      })
      if (!image.url?.startsWith(E2E_MEDIA_ORIGIN)) {
        throw new Error('E2E storage must return controlled Media original URLs.')
      }
      return image
    }),
  )
  const card = (title: string, index: number) => ({
    image: media[index]!.id,
    link: unlabeledLink(`/e2e-card-${index + 1}`),
    title,
  })
  const productContent = [
    {
      blockType: 'categoryTabs' as const,
      enableCta: true,
      cta: customLink('E2E Browse every category', '/e2e-all-categories'),
      categories: [
        {
          enableCta: true,
          cta: customLink('E2E Browse foundations', '/e2e-foundations'),
          items: [card('E2E Foundation card', 0), card('E2E Foundation reserve card', 1)],
          label: 'E2E Foundations',
        },
        {
          items: [card('E2E Advanced card', 2)],
          label: 'E2E Advanced long category label for overflow coverage',
        },
      ],
    },
    {
      blockType: 'cardGroup' as const,
      cta: customLink('E2E View all card group', '/e2e-card-group'),
      enableCta: true,
      enableHeading: true,
      heading: 'E2E Featured card group',
      items: [
        card('E2E Visual one card', 3),
        card('E2E Visual two card', 4),
        card('E2E Visual three card with a deliberately long title that wraps safely', 5),
        card('E2E Visual four card', 6),
        card('E2E Visual five card', 7),
        card('E2E Visual six card', 3),
        card('E2E Visual seven card', 4),
        card('E2E Visual eight card', 5),
      ],
    },
    {
      blockType: 'linkGroup' as const,
      enableHeading: true,
      heading: 'E2E Product links',
      links: [
        { link: customLink('E2E Product overview', '/e2e-product-overview') },
        { link: customLink('E2E Product documentation', '/e2e-product-docs') },
      ],
    },
    {
      blockType: 'richCard' as const,
      description: 'E2E rich card description for the compact content flow.',
      ...card('E2E Rich card', 7),
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
          label: 'E2E Hybrid Hub with a deliberately long label',
          link: { reference: { relationTo: 'pages', value: routePage.id }, type: 'reference' },
          navigationType: 'directLinkAndDropdown',
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          label: `E2E Extra Navigation ${index + 1} with a long label`,
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

async function openFixture(page: Page, width: number, options: { failMedia?: string } = {}) {
  const placeholderRequests: string[] = []
  const requests: string[] = []
  const failedRequests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('requestfailed', (request) => failedRequests.push(request.url()))
  await page.route('https://media.example.invalid/**', async (route) => {
    const url = route.request().url()
    placeholderRequests.push(url)
    if (options.failMedia && url.includes(options.failMedia)) {
      await route.abort('failed')
      return
    }
    await route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      contentType: 'image/svg+xml',
    })
  })
  ;(page as Page & { e2ePlaceholderRequests?: string[] }).e2ePlaceholderRequests =
    placeholderRequests
  ;(page as Page & { e2eRequests?: string[] }).e2eRequests = requests
  ;(page as Page & { e2eFailedRequests?: string[] }).e2eFailedRequests = failedRequests
  await page.setViewportSize({ height: width < 768 ? 844 : 960, width })
  await page.goto(`${baseURL}${fixturePath}`)
  await expect(page.locator('header > div')).toBeVisible()
  await expect(page.locator('main#main-content')).toBeAttached()
  await expect(page.locator('footer')).toBeVisible()
}

async function expectNoProductionDomainRequests(page: Page) {
  await expect
    .poll(() => (page as Page & { e2eRequests?: string[] }).e2eRequests ?? [])
    .not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/https?:\/\/(?:[a-z0-9-]+\.)*ecolitea\.com(?::|\/|$)/i),
      ]),
    )
}

const placeholderRequests = (page: Page) =>
  (page as Page & { e2ePlaceholderRequests?: string[] }).e2ePlaceholderRequests ?? []

async function expectImageRequests(page: Page, ...names: RegExp[]) {
  await expect
    .poll(() => placeholderRequests(page))
    .toEqual(expect.arrayContaining(names.map((name) => expect.stringMatching(name))))
}

async function expectNoImageRequests(page: Page, ...names: RegExp[]) {
  for (const name of names) {
    await expect
      .poll(() => placeholderRequests(page))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(name)]))
  }
}

async function setPanelScrollTop(panel: ReturnType<Page['locator']>, value: number) {
  await panel.evaluate((element, next) => {
    element.scrollTop = next
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  }, value)
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
    const headerSurface = document.querySelector('header > div')!.getBoundingClientRect()
    const main = document.querySelector('main#main-content')!.getBoundingClientRect()
    const footer = document.querySelector('footer')!.getBoundingClientRect()
    return {
      footerTop: footer.top,
      headerBottom: header.bottom,
      headerHeight: header.height,
      headerSurfaceBottom: headerSurface.bottom,
      mainBottom: main.bottom,
      mainTop: main.top,
    }
  })
  expect(geometry.headerHeight).toBe(0)
  expect(geometry.mainTop).toBeLessThanOrEqual(geometry.headerSurfaceBottom)
  expect(geometry.footerTop).toBeGreaterThanOrEqual(geometry.mainBottom)
  expect(
    await page
      .locator('header, main#main-content, footer')
      .evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase())),
  ).toEqual(['header', 'main', 'footer'])
  await expectNoProductionDomainRequests(page)
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
  await openButton.focus()
  await page.keyboard.press('Enter')
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
  await products.focus()
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('heading', { name: 'E2E Products' })).toBeVisible()
  const foundations = dialog.getByRole('button', { name: 'E2E Foundations' })
  const advanced = dialog.getByRole('button', {
    name: 'E2E Advanced long category label for overflow coverage',
  })
  await expect(foundations).toHaveAttribute('aria-expanded', 'false')
  await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  await expect(dialog.getByRole('link', { name: 'E2E Foundation card' })).toHaveCount(0)
  await expectNoImageRequests(
    page,
    /e2e-navigation-1\.png/,
    /e2e-navigation-2\.png/,
    /e2e-navigation-3\.png/,
  )
  await expect(dialog.getByRole('button', { name: 'Back to navigation' })).toBeFocused()
  await foundations.click()
  await expect(foundations).toBeFocused()
  await expect(foundations).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.getByRole('link', { name: 'E2E Foundation card' })).toBeVisible()
  await expectImageRequests(page, /e2e-navigation-1\.png/, /e2e-navigation-2\.png/)
  await advanced.click()
  await expect(advanced).toBeFocused()
  await expect(foundations).toHaveAttribute('aria-expanded', 'false')
  await expect(advanced).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.getByRole('link', { name: 'E2E Advanced card' })).toBeVisible()
  await expectImageRequests(page, /e2e-navigation-3\.png/)
  await expectNoProductionDomainRequests(page)
  await expect(dialog.getByRole('heading', { name: 'E2E Featured card group' })).toBeVisible()
  await expect(dialog.locator('[data-navigation-block="cardGroup"] a')).toHaveCount(9)
  await expect(dialog.getByRole('link', { name: 'E2E Rich card' })).toBeVisible()
  const blockWidths = await dialog.locator('[data-navigation-block]').evaluateAll((blocks) =>
    blocks.map((block) => ({
      width: block.getBoundingClientRect().width,
      availableWidth: block.parentElement!.getBoundingClientRect().width,
    })),
  )
  for (const block of blockWidths) {
    expect(Math.abs(block.width - block.availableWidth)).toBeLessThanOrEqual(1)
  }
  await shot(page, testInfo, 'mobile-section')
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('heading', { name: 'E2E Products' })).toBeHidden()
  await expect(products).toBeFocused()
  await products.click()
  await expect(advanced).toHaveAttribute('aria-expanded', 'true')
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
  const rootPanel = dialog.getByTestId('mobile-navigation-root')
  const rootCta = dialog.getByRole('link', { name: 'E2E Talk to sales' })
  await rootCta.scrollIntoViewIfNeeded()
  await expect(rootCta).toBeVisible()
  expect(await rootPanel.evaluate((panel) => panel.scrollHeight)).toBeGreaterThanOrEqual(
    await rootPanel.evaluate((panel) => panel.clientHeight),
  )
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
  return page.getByRole('button', { exact: true, name })
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

  for (const width of [390, 1024]) {
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

  for (const width of [1171, 1280, 1440]) {
    test(`${width}px uses three desktop zones and desktop menus`, async ({ page }, testInfo) => {
      await openFixture(page, width)
      await expectShell(page)
      await expectThemeInvariant(page)
      await expectNewsletter(page)
      await expectFooterIdentityAndContact(page)
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden()
      await expectDesktopZones(page)
      await shot(page, testInfo, 'closed')

      if (width === 1280) {
        const strip = page.getByRole('navigation', { name: 'Primary' })
        const scrollLeft = page.getByRole('button', { name: 'Scroll navigation left' })
        const scrollRight = page.getByRole('button', { name: 'Scroll navigation right' })
        await expect(scrollRight).toBeVisible()
        await expect(scrollRight).toBeDisabled()
        await expect(scrollLeft).toBeEnabled()
        const rightEdge = await strip.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollLeft: element.scrollLeft,
          scrollWidth: element.scrollWidth,
        }))
        expect(Math.abs(rightEdge.scrollLeft + rightEdge.clientWidth - rightEdge.scrollWidth)).toBeLessThanOrEqual(1)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await scrollLeft.focus()
        await page.keyboard.press('Enter')
        await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeLessThan(rightEdge.scrollLeft)
      }

      const products = await exposeDesktopControl(page, 'E2E Products')
      await products.hover()
      const menu = page.getByRole('region', { name: 'E2E Products menu' })
      await expect(menu).toBeVisible()
      await expect(menu.locator('[data-navigation-block="categoryTabs"]')).toHaveCount(1)
      await expect(menu.locator('[data-navigation-block="cardGroup"]')).toHaveCount(1)
      await expect(menu.locator('[data-navigation-block="linkGroup"]')).toHaveCount(1)
      await expect(menu.locator('[data-navigation-block="richCard"]')).toHaveCount(1)
      await expect(menu.getByRole('link', { name: 'E2E Foundation card' })).toBeVisible()
      await expect(menu.locator('[data-navigation-block="cardGroup"] a')).toHaveCount(9)
      await menu.getByRole('link', { name: 'E2E Foundation card' }).hover()
      await expect(menu).toBeVisible()
      if (width === 1280) {
        await expect(menu.locator('[data-navigation-block="cardGroup"] img').first()).toHaveCSS(
          'transition-duration',
          '0s',
        )
        await expect(menu).toBeVisible()
      }
      await shot(page, testInfo, 'desktop-mega-menu')
      await page.keyboard.press('Escape')

      const hybridLink = page.getByRole('link', {
        name: 'E2E Hybrid Hub with a deliberately long label',
        exact: true,
      })
      await hybridLink.hover()
      await expect(
        page.getByRole('region', {
          name: 'E2E Hybrid Hub with a deliberately long label menu',
        }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await hybridLink.focus()
      await page.keyboard.press('ArrowDown')
      await expect(
        page.getByRole('region', {
          name: 'E2E Hybrid Hub with a deliberately long label menu',
        }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await hybridLink.click()
      await expect(page).toHaveURL(`${baseURL}${routePath}`)

      const footer = page.getByRole('navigation', { name: 'Footer' })
      await expect(footer.locator('section')).toHaveCount(4)
      await expect(footer.locator('section').first().getByRole('button')).toBeHidden()
      await expect(footer.locator('section').first().locator('h2')).toBeVisible()
    })
  }

  test('Desktop navigation keeps the Mega Menu open while wheel input chains to the page', async ({
    page,
  }) => {
    await openFixture(page, 1280)
    await page.evaluate(() => {
      document.body.style.minHeight = '200vh'
    })
    await page.getByRole('button', { name: 'E2E Products' }).click()
    const menu = page.getByRole('region', { name: 'E2E Products menu' })
    const scrollRegion = menu.locator('[data-mega-menu-scroll="true"]')
    await expect(menu).toBeVisible()
    await expect
      .poll(() => scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true)

    await scrollRegion.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const box = await scrollRegion.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    const beforeDown = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeDown)
    const afterDown = await page.evaluate(() => window.scrollY)
    expect(afterDown - beforeDown).toBeLessThanOrEqual(600)
    await expect(menu).toBeVisible()

    await page.evaluate(() => window.scrollTo(0, 500))
    await scrollRegion.evaluate((element) => {
      element.scrollTop = 0
    })
    const beforeUp = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, -600)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(beforeUp)
    const afterUp = await page.evaluate(() => window.scrollY)
    expect(beforeUp - afterUp).toBeLessThanOrEqual(600)
    await expect(menu).toBeVisible()
  })

  test('strict >1170px mode query keeps 1170px Compact and switches 1171px to Desktop', async ({
    page,
  }) => {
    await openFixture(page, 1170)
    // Playwright only accepts integral CSS viewport pixels. The production selector is
    // nevertheless fractional-safe: any width strictly greater than 1170px matches.
    await expect
      .poll(() => page.evaluate(() => window.matchMedia('(width > 1170px)').matches))
      .toBe(false)
    const compactOpen = page.getByRole('button', { name: 'Open navigation' })
    await expect(compactOpen).toBeVisible()
    await compactOpen.click()
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
    await page.setViewportSize({ width: 1171, height: 960 })
    await expect
      .poll(() => page.evaluate(() => window.matchMedia('(width > 1170px)').matches))
      .toBe(true)
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await expect(page.getByRole('button', { name: 'E2E Products' })).toBeVisible()

    await page.getByRole('button', { name: 'E2E Products' }).click()
    await expect(page.getByRole('region', { name: 'E2E Products menu' })).toBeVisible()
    await page.setViewportSize({ width: 1024, height: 960 })
    await expect(page.getByRole('region', { name: 'E2E Products menu' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
    await expectNoProductionDomainRequests(page)
  })

  test('retains usable card anchors when a local navigation image fails', async ({ page }) => {
    await openFixture(page, 1280, { failMedia: 'e2e-navigation-6.png' })
    await page.getByRole('button', { name: 'E2E Products' }).click()
    const failedImageCard = page.getByRole('link', {
      name: 'E2E Visual three card with a deliberately long title that wraps safely',
    })
    await expect(failedImageCard).toBeVisible()
    await expect(failedImageCard.locator('img')).toBeAttached()
    await expect
      .poll(() => (page as Page & { e2eFailedRequests?: string[] }).e2eFailedRequests ?? [])
      .toEqual(expect.arrayContaining([expect.stringMatching(/e2e-navigation-6\.png/)]))
    await expect
      .poll(() =>
        failedImageCard
          .locator('img')
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBe(0)
    await expectNoProductionDomainRequests(page)
  })

  test('close resets Compact session state while Back restores root and section scroll state', async ({
    page,
  }) => {
    await openFixture(page, 390)
    await page.setViewportSize({ width: 390, height: 520 })
    const openButton = page.getByRole('button', { name: 'Open navigation' })
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await openButton.click()
    const rootPanel = dialog.getByTestId('mobile-navigation-root')
    await setPanelScrollTop(rootPanel, 120)
    await expect.poll(() => rootPanel.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0)

    const products = dialog.getByRole('button', { name: 'Open E2E Products' })
    await products.evaluate((button) => (button as HTMLButtonElement).click())
    const sectionPanel = dialog.getByTestId('mobile-navigation-section')
    await setPanelScrollTop(sectionPanel, 120)
    await expect.poll(() => sectionPanel.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0)
    await dialog.getByRole('button', { name: 'Back to navigation' }).click()
    await expect.poll(() => rootPanel.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0)

    await products.evaluate((button) => (button as HTMLButtonElement).click())
    await expect.poll(() => sectionPanel.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0)
    await dialog.getByRole('button', { name: 'Close navigation' }).click()
    await expect(dialog).toBeHidden()

    await openButton.click()
    await expect.poll(() => rootPanel.evaluate((panel) => panel.scrollTop)).toBe(0)
    await products.evaluate((button) => (button as HTMLButtonElement).click())
    await expect(dialog.getByRole('button', { name: 'E2E Foundations' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect.poll(() => sectionPanel.evaluate((panel) => panel.scrollTop)).toBe(0)
    await expectNoProductionDomainRequests(page)
  })

  test('keyboard-only Desktop navigation opens, switches categories, and operates overflow', async ({
    page,
  }) => {
    await openFixture(page, 1280)
    const products = page.getByRole('button', { name: 'E2E Products' })
    await products.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('region', { name: 'E2E Products menu' })
    await expect(menu).toBeVisible()
    const advanced = menu.getByRole('tab', {
      name: 'E2E Advanced long category label for overflow coverage',
    })
    await advanced.focus()
    await page.keyboard.press('Enter')
    await expect(advanced).toHaveAttribute('aria-selected', 'true')
    await expect(menu.getByRole('link', { name: 'E2E Advanced card' })).toBeVisible()

    const strip = page.getByRole('navigation', { name: 'Primary' })
    const scrollRight = page.getByRole('button', { name: 'Scroll navigation right' })
    await scrollRight.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(products).toBeFocused()
    await expectNoProductionDomainRequests(page)
  })

  test('reduced motion removes Compact category transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, 390)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await dialog.getByRole('button', { name: 'Open E2E Products' }).click()
    const foundations = dialog.getByRole('button', { name: 'E2E Foundations' })
    await foundations.click()
    const chevron = foundations.locator('svg')
    await expect(chevron).toHaveCSS('transition-duration', '0s')
    await expect(chevron).toHaveCSS('transform', 'none')
    await expectNoProductionDomainRequests(page)
  })
})
