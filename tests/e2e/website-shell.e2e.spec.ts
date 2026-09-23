import { expect, type Page, test, type TestInfo } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { normalizeComputedColor } from '../helpers/computedColor'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const baseURL = getE2EBaseURL()
const E2E_MEDIA_ORIGIN = 'https://media.example.invalid'
const NAVIGATION_IMAGE_ALT_PREFIX = 'E2E website shell navigation image'
type HeaderThemeTransitionSample = {
  color: string | null
  headerTheme: string | null
  markerTheme: string | null
}
type WindowWithHeaderThemeSamples = Window & {
  __headerThemeSamples?: HeaderThemeTransitionSample[]
  __headerThemeObserver?: MutationObserver
}
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

const customLink = (label: string, url: string) => ({ label, type: 'custom' as const, url })
const unlabeledLink = (url: string) => ({ type: 'custom' as const, url })
const navigationImagePNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
const emptyPage = (slug: string, title: string) => ({
  _status: 'published' as const,
  hero: { headerTheme: 'light' as const, type: 'none' as const },
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
        data: {
          ...emptyPage(slug, `E2E ${key} page`),
          ...(key === 'route'
            ? { hero: { headerTheme: 'dark' as const, type: 'lowImpact' as const } }
            : {}),
        },
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

async function openFixture(
  page: Page,
  width: number,
  options: { failMedia?: string; height?: number } = {},
) {
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
  await page.setViewportSize({ height: options.height ?? (width < 768 ? 844 : 960), width })
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
  await expect(page.locator('[data-theme]')).toHaveCount(1)
  await expect(page.locator('header > div')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('footer')).toHaveAttribute('data-website-theme', 'inverse')
  await expect(page.locator('footer')).toHaveCSS('background-color', 'rgb(10, 10, 10)')
  await expect(page.locator('footer')).toHaveCSS('color', 'rgb(255, 255, 255)')
  expect(
    await page
      .locator('html, body, main#main-content, footer')
      .evaluateAll((elements) => elements.some((element) => element.hasAttribute('data-theme'))),
  ).toBe(false)
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
  await expect(logo).not.toHaveAttribute('src', /.*/)
  await expect
    .poll(() => logo.evaluate((element) => getComputedStyle(element).maskImage))
    .toMatch(/^url\("https:\/\/media\.example\.invalid\/e2e-website-shell-logo\.svg\?/)

  const social = page.locator('[data-footer-content="social"]')
  await expect(social.getByRole('link', { name: 'E2E LinkedIn' })).toHaveAttribute(
    'href',
    'https://example.com/e2e-linkedin',
  )
  const socialIcon = social.locator('img')
  await expect(socialIcon).toBeVisible()
  await expect(socialIcon).toHaveAttribute(
    'src',
    /^https:\/\/media\.example\.invalid\/e2e-website-shell-logo\.svg\?/,
  )
  await expect(socialIcon).not.toHaveAttribute('src', /\/_next\/image/)
  await expect(socialIcon).not.toHaveAttribute('src', /\/cdn-cgi\//)
  await expect
    .poll(() => (page as Page & { e2ePlaceholderRequests?: string[] }).e2ePlaceholderRequests ?? [])
    .toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^https:\/\/media\.example\.invalid\/e2e-website-shell-logo\.svg\?/),
      ]),
    )

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

async function expectBackground(
  locator: ReturnType<Page['locator']>,
  expected: { alpha: number; blue: number; green: number; red: number },
) {
  await expect
    .poll(async () => {
      const color = await locator.evaluate((element) => getComputedStyle(element).backgroundColor)
      return normalizeComputedColor(color)
    })
    .toEqual([expected.red, expected.green, expected.blue, expected.alpha])
}

async function expectIndicatorAligned(page: Page, control: ReturnType<Page['locator']>) {
  const item = page.locator('[data-nav-item-id]').filter({ has: control })
  const indicator = page.locator('[data-navigation-indicator="true"]')
  await expect(indicator).toHaveAttribute('data-visible', 'true')
  await expect
    .poll(async () => {
      const [indicatorBox, itemBox] = await Promise.all([
        indicator.boundingBox(),
        item.boundingBox(),
      ])
      if (!indicatorBox || !itemBox) return Number.POSITIVE_INFINITY
      return Math.max(
        Math.abs(indicatorBox.x - itemBox.x),
        Math.abs(indicatorBox.width - itemBox.width),
      )
    })
    .toBeLessThanOrEqual(1)
}

async function exerciseMobile(page: Page, testInfo: TestInfo) {
  const openButton = page.getByRole('button', { name: 'Open navigation' })
  const surface = page.locator('header > div')
  await expectBackground(surface, { alpha: 0, blue: 0, green: 0, red: 0 })
  const dialog = page.getByRole('dialog', { name: 'Navigation' })
  await openButton.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expectBackground(surface, { alpha: 0.9, blue: 255, green: 255, red: 255 })
  const dialogSurface = dialog.locator('[data-mobile-navigation-surface="true"]')
  await expectBackground(dialogSurface, {
    alpha: 1,
    blue: 255,
    green: 255,
    red: 255,
  })
  await expect(page.locator('[data-navigation-overlay="true"]')).toHaveCount(0)
  const viewport = page.viewportSize()!
  await expect
    .poll(async () => {
      const box = await dialogSurface.boundingBox()
      if (!box) return null
      return { x: box.x, width: box.width, y: box.y, bottom: box.y + box.height }
    })
    .toEqual({ x: 0, width: viewport.width, y: expect.any(Number), bottom: viewport.height })
  const dialogBox = await dialogSurface.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.y).toBeGreaterThan(0)
  const logoBox = await dialog.getByRole('link', { name: 'E2E website shell logo' }).boundingBox()
  expect(logoBox).not.toBeNull()
  expect(logoBox!.x + logoBox!.width / 2).toBeCloseTo(viewport.width / 2, 0)
  const menuLines = dialog.getByRole('button', { name: 'Close navigation' }).locator('span')
  await expect(menuLines).toHaveCount(3)
  await expect(menuLines.nth(0)).toHaveCSS('transform', /matrix/)
  await expect(menuLines.nth(1)).toHaveCSS('opacity', '0')

  const products = dialog
    .locator('button[aria-controls^="mobile-navigation-section-"]')
    .filter({ hasText: 'E2E Products' })
  const hybrid = dialog
    .locator('button[aria-controls^="mobile-navigation-section-"]')
    .filter({ hasText: 'E2E Hybrid Hub with a deliberately long label' })
  await expect(products).toHaveAttribute('aria-expanded', 'false')
  await expect(hybrid).toHaveAttribute('aria-expanded', 'false')
  await products.focus()
  await page.keyboard.press('Enter')
  const productsPanelID = await products.getAttribute('aria-controls')
  expect(productsPanelID).toBeTruthy()
  const productsPanel = dialog.locator(`#${productsPanelID}`)
  await expect(products).toHaveAttribute('aria-expanded', 'true')
  await expect(hybrid).toHaveAttribute('aria-expanded', 'false')
  await expect(products).toBeVisible()
  await expect(hybrid).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Back to navigation' })).toHaveCount(0)
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
  await expect(productsPanel.locator('[data-navigation-block="cardGroup"] a')).toHaveCount(9)
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
  if (viewport.width > 360) {
    await foundations.click()
    await expect(foundations).toHaveAttribute('aria-expanded', 'true')
    const productCards = dialog.getByRole('link', { name: /E2E Foundation (?:card|reserve card)/ })
    const productBoxes = await productCards.evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect()).map(({ width, x, y }) => ({ width, x, y })),
    )
    expect(productBoxes).toHaveLength(2)
    expect(Math.abs(productBoxes[0]!.y - productBoxes[1]!.y)).toBeLessThanOrEqual(1)
    expect(productBoxes[1]!.x).toBeGreaterThan(productBoxes[0]!.x + productBoxes[0]!.width)
  }
  await shot(page, testInfo, 'mobile-section')

  await hybrid.click()
  await expect(products).toHaveAttribute('aria-expanded', 'false')
  await expect(hybrid).toHaveAttribute('aria-expanded', 'true')
  await expect(
    dialog.getByRole('link', { name: 'View all E2E Hybrid Hub with a deliberately long label' }),
  ).toHaveAttribute('href', routePath)
  await expect(dialog.getByRole('button', { name: 'E2E Foundations' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )

  const first = dialog.locator('a[href], button:not([disabled])').first()
  const last = dialog.locator('a[href], button:not([disabled])').last()
  await first.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(openButton).toBeFocused()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await page.evaluate(() => {
    document.body.style.minHeight = '200vh'
    window.scrollTo(0, 100)
  })
  await expect(surface).toHaveAttribute('data-scrolled', 'true')
  await expectBackground(surface, { alpha: 0.9, blue: 255, green: 255, red: 255 })
  await page.evaluate(() => window.scrollTo(0, 0))

  await openButton.click()
  const rootPanel = dialog.getByTestId('mobile-navigation-root')
  const rootCta = dialog.getByRole('link', { name: 'E2E Talk to sales' })
  const ctaBar = dialog.locator('[data-mobile-cta-bar="true"]')
  await expect(rootCta).toBeVisible()
  await expect(ctaBar).toHaveCSS('position', 'fixed')
  const ctaBarBox = await ctaBar.boundingBox()
  expect(ctaBarBox).not.toBeNull()
  expect(ctaBarBox!.y + ctaBarBox!.height).toBeCloseTo(viewport.height, 0)
  expect(await rootPanel.evaluate((panel) => panel.scrollHeight)).toBeGreaterThanOrEqual(
    await rootPanel.evaluate((panel) => panel.clientHeight),
  )
  await dialog.getByRole('button', { name: 'Close navigation' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await openButton.click()
  await expect(products).toHaveAttribute('aria-expanded', 'false')
  await products.click()
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
      page.getByRole('link', { name: 'Search' }),
    ],
    [
      page.locator('[data-footer-content="brand"]'),
      page.locator('[data-footer-content="navigation"]'),
      page.locator('[data-footer-content="newsletter"]'),
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

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 1024, width: 768 },
    { height: 768, width: 1024 },
    { height: 900, width: 1440 },
  ]) {
    test('keeps shell geometry at ' + viewport.width, async ({ page }) => {
      await openFixture(page, viewport.width, { height: viewport.height })
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await expect(page.locator('header')).toBeAttached()
      await expect(page.locator('main#main-content')).toBeAttached()
      await expect(page.locator('footer')).toBeVisible()
    })
  }

  for (const width of [390, 1024]) {
    test(`${width}px uses shared full-screen accordion navigation`, async ({ page }, testInfo) => {
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

  test('768x1024 keeps the full-screen Compact navigation boundary', async ({ page }, testInfo) => {
    await openFixture(page, 768, { height: 1024 })
    expect(page.viewportSize()).toEqual({ height: 1024, width: 768 })
    await expectShell(page)
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
    await expect(page.locator('[data-desktop-nav-root="true"]')).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation' }).click()
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect(dialog).toBeVisible()
    const dialogSurface = dialog.locator('[data-mobile-navigation-surface="true"]')
    await expect(dialogSurface).toHaveCSS('opacity', '1')
    // The mobile navigation opens with a short transform animation. Wait for
    // the final full-height geometry instead of sampling its intermediate
    // 60px header-height state.
    await expect
      .poll(async () => {
        const box = await dialogSurface.boundingBox()
        return box ? { x: box.x, width: box.width, bottom: box.y + box.height } : null
      })
      .toEqual({ x: 0, width: 768, bottom: 1024 })
    await shot(page, testInfo, 'tablet-root')

    const products = dialog
      .locator('button[aria-controls^="mobile-navigation-section-"]')
      .filter({ hasText: 'E2E Products' })
    await products.click()
    const productsPanelID = await products.getAttribute('aria-controls')
    expect(productsPanelID).toBeTruthy()
    const visualCards = dialog.locator(
      `#${productsPanelID} [data-navigation-block="cardGroup"] a:not([href="/e2e-card-group"])`,
    )
    await expect(visualCards).toHaveCount(8)
    const computedColumns = await visualCards
      .first()
      .locator('..')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns)
    expect(computedColumns.trim().split(/\s+/)).toHaveLength(2)
    await expectNoProductionDomainRequests(page)
  })

  test('Desktop overflow navigation follows horizontal trackpad input', async ({ page }) => {
    await openFixture(page, 1280)
    const strip = page.getByRole('navigation', { name: 'Primary' })
    const scrollLeft = page.getByRole('button', { name: 'Scroll navigation left' })
    const scrollRight = page.getByRole('button', { name: 'Scroll navigation right' })
    await expect(scrollRight).toBeVisible()
    await expect(scrollRight).toBeDisabled()
    await expect(scrollLeft).toBeEnabled()
    const rightEdge = await strip.evaluate((element) => element.scrollLeft)
    const stripBox = await strip.boundingBox()
    expect(stripBox).not.toBeNull()
    await page.mouse.move(stripBox!.x + stripBox!.width / 2, stripBox!.y + stripBox!.height / 2)
    await page.mouse.wheel(-80, 0)
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeLessThan(rightEdge)
    await expect(scrollRight).toBeEnabled()
    await page.mouse.wheel(1000, 0)
    await expect(scrollRight).toBeDisabled()
  })

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
      const surface = page.locator('header > div')
      await expectBackground(surface, { alpha: 0, blue: 0, green: 0, red: 0 })
      await page.evaluate(() => {
        document.body.style.minHeight = '200vh'
        window.scrollTo(0, 100)
      })
      await expect(surface).toHaveAttribute('data-scrolled', 'true')
      await expectBackground(surface, { alpha: 0.9, blue: 255, green: 255, red: 255 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await expect(surface).toHaveAttribute('data-scrolled', 'false')

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
        expect(
          Math.abs(rightEdge.scrollLeft + rightEdge.clientWidth - rightEdge.scrollWidth),
        ).toBeLessThanOrEqual(1)
        expect(rightEdge.scrollLeft).toBeGreaterThan(0)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        const products = await exposeDesktopControl(page, 'E2E Products')
        await products.focus()
        await expect
          .poll(() => strip.evaluate((element) => element.scrollLeft))
          .toBeLessThan(rightEdge.scrollLeft)
        await expectIndicatorAligned(page, products)
        const indicatorBeforeScroll = await page
          .locator('[data-navigation-indicator="true"]')
          .boundingBox()
        await scrollRight.focus()
        await page.keyboard.press('Enter')
        await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
        await expectIndicatorAligned(page, products)
        const indicatorAfterScroll = await page
          .locator('[data-navigation-indicator="true"]')
          .boundingBox()
        expect(indicatorAfterScroll).not.toBeNull()
        expect(indicatorBeforeScroll).not.toBeNull()
        expect(indicatorAfterScroll!.x).not.toBeCloseTo(indicatorBeforeScroll!.x, 0)
        await scrollLeft.focus()
        await page.keyboard.press('Enter')
      }

      const products = await exposeDesktopControl(page, 'E2E Products')
      await expect(page.getByRole('navigation', { name: 'Primary' }).locator('svg')).toHaveCount(0)
      await products.hover()
      const menu = page.getByRole('region', { name: 'E2E Products menu' })
      await expect(menu).toBeVisible()
      await expect(surface).toHaveAttribute('data-menu-open', 'true')
      await expectBackground(surface, { alpha: 0.9, blue: 255, green: 255, red: 255 })
      await expectBackground(menu, { alpha: 0.82, blue: 255, green: 255, red: 255 })
      const overlay = page.locator('[data-navigation-overlay="true"]')
      await expect(overlay).toBeVisible()
      await expectBackground(overlay, { alpha: 0.07, blue: 0, green: 0, red: 0 })
      await expect(menu.locator('[data-navigation-block="categoryTabs"]')).toHaveCount(1)
      await expect(menu.locator('[data-navigation-block="cardGroup"]')).toHaveCount(1)
      await expect(menu.locator('[data-navigation-block="linkGroup"]')).toHaveCount(1)
      await expect(menu.locator('[data-navigation-block="richCard"]')).toHaveCount(1)
      await expect(menu.getByRole('link', { name: 'E2E Foundation card' })).toBeVisible()
      await expect(menu.locator('[data-navigation-block="cardGroup"] a')).toHaveCount(9)
      await expect(menu.locator('[data-mega-menu-scroll="true"]')).toHaveCount(1)
      const visualCards = menu
        .locator('[data-navigation-block="cardGroup"]')
        .locator('a:not([href="/e2e-card-group"])')
      await expect(visualCards).toHaveCount(8)
      const visualCardRows = await visualCards.evaluateAll((cards) => {
        const rows = new Map<number, number>()
        for (const card of cards) {
          const top = Math.round(card.getBoundingClientRect().top)
          rows.set(top, (rows.get(top) ?? 0) + 1)
        }
        return [...rows.values()]
      })
      expect(visualCardRows).toEqual([4, 4])
      const categoryBlock = menu.locator('[data-navigation-block="categoryTabs"]')
      await expect(categoryBlock.locator('[data-category-selector-column]')).toHaveCSS(
        'position',
        'sticky',
      )
      const primaryCategoryCta = categoryBlock.getByRole('link', {
        name: 'E2E Browse every category',
      })
      const activeCategoryCta = categoryBlock.getByRole('link', {
        name: 'E2E Browse foundations',
      })
      await expect(primaryCategoryCta).toBeVisible()
      await expect(activeCategoryCta).toBeVisible()
      const [primaryCtaBox, activeCtaBox] = await Promise.all([
        primaryCategoryCta.boundingBox(),
        activeCategoryCta.boundingBox(),
      ])
      expect(primaryCtaBox).not.toBeNull()
      expect(activeCtaBox).not.toBeNull()
      expect(primaryCtaBox!.x).toBeLessThan(activeCtaBox!.x)
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
      const overlayBox = await overlay.boundingBox()
      expect(overlayBox).not.toBeNull()
      await page.mouse.click(
        overlayBox!.x + overlayBox!.width / 2,
        overlayBox!.y + overlayBox!.height - 4,
      )
      await expect(menu).toBeHidden()
      await expect(surface).toHaveAttribute('data-menu-open', 'false')

      const hybridLink = page.getByRole('link', {
        name: 'E2E Hybrid Hub with a deliberately long label',
        exact: true,
      })
      await hybridLink.hover()
      const hybridMenu = page.getByRole('region', {
        name: 'E2E Hybrid Hub with a deliberately long label menu',
      })
      await expect(hybridMenu).toBeVisible()
      await expectIndicatorAligned(page, hybridLink)
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

  test('Hero theme changes Header foreground while Logo uses the SVG CSS mask', async ({
    page,
  }) => {
    const serverResponse = await page.request.get(`${baseURL}${routePath}`)
    expect(serverResponse.ok()).toBe(true)
    expect(await serverResponse.text()).toContain('data-header-theme="dark"')

    const serverRenderedPage = await page.context().newPage()
    await serverRenderedPage.setViewportSize({ width: 1280, height: 960 })
    await serverRenderedPage.route('**/*', async (route) => {
      if (route.request().resourceType() === 'script') {
        await route.abort()
        return
      }
      await route.continue()
    })
    await serverRenderedPage.goto(`${baseURL}${routePath}`)
    const serverHeaderSurface = serverRenderedPage.locator('header > div')
    await expect(serverHeaderSurface).toHaveAttribute('data-theme', 'light')
    await expect(serverRenderedPage.getByRole('button', { name: 'E2E Products' })).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    )
    await expect(serverRenderedPage.getByRole('link', { name: 'Search' })).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    )
    await expect(serverRenderedPage.getByRole('link', { name: 'E2E Talk to sales' })).toHaveCSS(
      'color',
      'rgb(255, 255, 255)',
    )
    await serverRenderedPage.close()

    await openFixture(page, 1280)
    const headerSurface = page.locator('header > div')
    await expect(headerSurface).toHaveAttribute('data-theme', 'light')

    await page.goto(`${baseURL}${routePath}`)
    await expect(headerSurface).toHaveAttribute('data-theme', 'dark')
    const lowImpactHero = page.locator('[data-hero="low-impact"]')
    await expect(lowImpactHero).toBeVisible()
    const lowImpactLayout = await lowImpactHero.evaluate((element) => {
      const rootStyles = getComputedStyle(document.documentElement)
      const probe = document.createElement('div')
      probe.style.paddingTop = 'var(--website-section-standard)'
      probe.style.paddingLeft = 'var(--website-gutter)'
      document.body.append(probe)
      const probeStyles = getComputedStyle(probe)
      const expectedPadding = probeStyles.paddingTop
      const gutter = Number.parseFloat(probeStyles.paddingLeft)
      probe.remove()

      const siteMax =
        Number.parseFloat(rootStyles.getPropertyValue('--website-container-site')) *
        Number.parseFloat(rootStyles.fontSize)
      return {
        expectedPadding,
        expectedWidth: Math.min(window.innerWidth - 2 * gutter, siteMax),
        padding: getComputedStyle(element).paddingTop,
        width: element.getBoundingClientRect().width,
      }
    })
    expect(lowImpactLayout.padding).toBe(lowImpactLayout.expectedPadding)
    expect(lowImpactLayout.width).toBeCloseTo(lowImpactLayout.expectedWidth, 0)
    const products = page.getByRole('button', { name: 'E2E Products' })
    const search = page.getByRole('link', { name: 'Search' })
    const menuCta = page.getByRole('link', { name: 'E2E Talk to sales' })
    const scrollButton = page.getByRole('button', { name: 'Scroll navigation left' })
    const indicator = page.locator('[data-navigation-indicator="true"]')
    const expectedForeground = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--website-color-foreground)'
      document.body.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
    expect(expectedForeground).not.toBe('rgb(255, 255, 255)')
    await expect(products).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(search).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(menuCta).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(menuCta).toHaveCSS('border-color', 'rgb(255, 255, 255)')
    await expect(scrollButton).toBeVisible()
    await expect(scrollButton).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(indicator).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    const headerLogo = page.locator('header .site-container > a [role="img"]')
    await expect(headerLogo).toBeVisible()
    await expect(headerLogo).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(headerLogo).not.toHaveAttribute('src', /.*/)
    await expect
      .poll(() => headerLogo.evaluate((element) => getComputedStyle(element).maskImage))
      .toMatch(/^url\("https:\/\/media\.example\.invalid\/e2e-website-shell-logo\.svg\?/)

    await products.hover()
    await expect(headerSurface).toHaveAttribute('data-menu-open', 'true')
    const menuForeground = await headerSurface.evaluate(
      (element) => getComputedStyle(element).color,
    )
    expect(menuForeground).toBe(expectedForeground)
    await expect(products).toHaveCSS('color', menuForeground)
    await expect(search).toHaveCSS('color', menuForeground)
    await expect(menuCta).toHaveCSS('color', menuForeground)
    await expect(menuCta).toHaveCSS('border-color', menuForeground)
    await expect(scrollButton).toHaveCSS('color', menuForeground)
    await expect(indicator).toHaveCSS('background-color', menuForeground)

    await page.keyboard.press('Escape')
    await expect(headerSurface).toHaveAttribute('data-menu-open', 'false')
    await page.evaluate(() => {
      document.body.style.minHeight = '200vh'
      window.scrollTo(0, 100)
    })
    await expect(headerSurface).toHaveAttribute('data-scrolled', 'true')
    const scrolledForeground = await headerSurface.evaluate(
      (element) => getComputedStyle(element).color,
    )
    expect(scrolledForeground).toBe(expectedForeground)
    await expect(products).toHaveCSS('color', scrolledForeground)
    await expect(search).toHaveCSS('color', scrolledForeground)
    await expect(menuCta).toHaveCSS('color', scrolledForeground)
    await expect(menuCta).toHaveCSS('border-color', scrolledForeground)
    await expect(scrollButton).toHaveCSS('color', scrolledForeground)

    await page.evaluate(() => {
      const browserWindow = window as WindowWithHeaderThemeSamples
      browserWindow.__headerThemeSamples = []
      const observer = new MutationObserver(() => {
        const headerSurface = document.querySelector('header > div')
        const marker = document.querySelector('main [data-header-theme]')
        browserWindow.__headerThemeSamples?.push({
          color: headerSurface ? getComputedStyle(headerSurface).color : null,
          headerTheme: headerSurface?.getAttribute('data-theme') ?? null,
          markerTheme: marker?.getAttribute('data-header-theme') ?? null,
        })
      })
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-header-theme', 'data-theme'],
        childList: true,
        subtree: true,
      })
      browserWindow.__headerThemeObserver = observer
    })

    const directLink = page.getByRole('link', { name: 'E2E Direct' })
    await directLink.scrollIntoViewIfNeeded()
    await directLink.click()
    await expect(page).toHaveURL(`${baseURL}/${slugs.direct}`)
    await expect(headerSurface).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('main [data-header-theme="dark"]')).toHaveCount(0)
    await expect(headerSurface).toHaveCSS('color', expectedForeground)
    await expect(search).toHaveCSS('color', expectedForeground)

    const transitionSamples = await page.evaluate(() => {
      const browserWindow = window as WindowWithHeaderThemeSamples
      browserWindow.__headerThemeObserver?.disconnect()
      return browserWindow.__headerThemeSamples ?? []
    })
    expect(transitionSamples.length).toBeGreaterThan(0)
    expect(
      transitionSamples.filter(
        (sample) =>
          sample.markerTheme !== 'dark' &&
          (sample.headerTheme !== 'light' || sample.color !== expectedForeground),
      ),
    ).toEqual([])
  })

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

  test('Desktop pointer intent delays initial open and close but switches menus immediately', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-01-01T08:00:00Z') })
    await openFixture(page, 1440)
    await page.clock.pauseAt(new Date('2026-01-01T10:00:00Z'))
    const products = page.getByRole('button', { name: 'E2E Products' })
    const productsMenu = page.getByRole('region', { name: 'E2E Products menu' })
    await products.hover()
    await page.clock.runFor(99)
    await expect(productsMenu).toHaveCount(0)
    await page.clock.runFor(1)
    await expect(productsMenu).toBeVisible()

    const hybrid = page.getByRole('link', {
      exact: true,
      name: 'E2E Hybrid Hub with a deliberately long label',
    })
    const hybridMenu = page.getByRole('region', {
      name: 'E2E Hybrid Hub with a deliberately long label menu',
    })
    await hybrid.hover()
    await expect(hybridMenu).toBeVisible()

    const overlay = page.locator('[data-navigation-overlay="true"]')
    const menuShell = page.locator('[data-mega-menu-shell="true"]')
    const surface = page.locator('header > div')
    const overlayBox = await overlay.boundingBox()
    expect(overlayBox).not.toBeNull()
    await page.mouse.move(
      overlayBox!.x + overlayBox!.width / 2,
      overlayBox!.y + overlayBox!.height - 4,
    )
    await page.clock.runFor(199)
    await expect(hybridMenu).toBeVisible()
    await expect(surface).toHaveAttribute('data-menu-open', 'true')
    await expect(menuShell).toHaveAttribute('data-phase', 'open')
    await page.clock.runFor(1)
    await expect(surface).toHaveAttribute('data-menu-open', 'false')
    await expect(menuShell).toHaveAttribute('data-phase', 'closing')
    await page.clock.runFor(180)
    await expect(hybridMenu).toHaveCount(0)
  })

  test('360px applies the computed one-column Card Group fallback', async ({ page }) => {
    await openFixture(page, 360)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await dialog
      .locator('button[aria-controls^="mobile-navigation-section-"]')
      .filter({ hasText: 'E2E Products' })
      .click()
    const products = dialog
      .locator('button[aria-controls^="mobile-navigation-section-"]')
      .filter({ hasText: 'E2E Products' })
    const productsPanelID = await products.getAttribute('aria-controls')
    expect(productsPanelID).toBeTruthy()
    const cardGroup = dialog.locator(`#${productsPanelID} [data-navigation-block="cardGroup"]`)
    const cards = cardGroup.locator('a:not([href="/e2e-card-group"])')
    await expect(cards).toHaveCount(8)
    const computedColumns = await cards
      .first()
      .locator('..')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns)
    expect(computedColumns.trim().split(/\s+/)).toHaveLength(1)
    const firstTwo = await cards.evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y }
      }),
    )
    expect(firstTwo[0]!.x).toBeCloseTo(firstTwo[1]!.x, 0)
    expect(firstTwo[1]!.y).toBeGreaterThan(firstTwo[0]!.y)
    await expectShell(page)
  })

  test('strict >1170px mode query keeps 1170px Compact and switches 1171px to Desktop', async ({
    page,
  }) => {
    await openFixture(page, 1170)
    await expect(page.locator('header .site-container > a').first()).toBeVisible()
    // Playwright only accepts integral CSS viewport pixels. The production selector is
    // nevertheless fractional-safe: any width strictly greater than 1170px matches.
    await expect
      .poll(() => page.evaluate(() => window.matchMedia('(width > 1170px)').matches))
      .toBe(false)
    const compactOpen = page.getByRole('button', { name: 'Open navigation' })
    await expect(compactOpen).toBeVisible()
    await page.setViewportSize({ width: 1169, height: 960 })
    await expect(page.locator('header .site-container > a').first()).toBeHidden()
    await page.setViewportSize({ width: 1170, height: 960 })
    await compactOpen.click()
    const compactDialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect(compactDialog).toBeVisible()
    const compactProducts = compactDialog
      .locator('button[aria-controls^="mobile-navigation-section-"]')
      .filter({ hasText: 'E2E Products' })
    await compactProducts.click()
    const compactProductPanelID = await compactProducts.getAttribute('aria-controls')
    expect(compactProductPanelID).toBeTruthy()
    const compactCardGrid = compactDialog.locator(
      `#${compactProductPanelID} [data-navigation-block="cardGroup"] > div:last-child`,
    )
    await expect
      .poll(() =>
        compactCardGrid.evaluate(
          (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        ),
      )
      .toBe(2)
    await page.setViewportSize({ width: 1171, height: 960 })
    await expect
      .poll(() => page.evaluate(() => window.matchMedia('(width > 1170px)').matches))
      .toBe(true)
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await expect(page.getByRole('button', { name: 'E2E Products' })).toBeVisible()

    await page.getByRole('button', { name: 'E2E Products' }).click()
    const desktopMenu = page.getByRole('region', { name: 'E2E Products menu' })
    await expect(desktopMenu).toBeVisible()
    await desktopMenu.getByRole('link', { name: 'E2E Foundation card' }).focus()
    await page.setViewportSize({ width: 1024, height: 960 })
    await expect(desktopMenu).toBeHidden()
    const compactTrigger = page.getByRole('button', { name: 'Open navigation' })
    await expect(compactTrigger).toBeVisible()
    await expect(compactTrigger).toBeFocused()
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

  test('close and top-level switches reset Compact accordion session state', async ({ page }) => {
    await openFixture(page, 390)
    await page.setViewportSize({ width: 390, height: 520 })
    const openButton = page.getByRole('button', { name: 'Open navigation' })
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await openButton.click()
    const rootPanel = dialog.getByTestId('mobile-navigation-root')
    await setPanelScrollTop(rootPanel, 120)
    await expect.poll(() => rootPanel.evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0)

    const products = dialog
      .locator('button[aria-controls^="mobile-navigation-section-"]')
      .filter({ hasText: 'E2E Products' })
    const hybrid = dialog
      .locator('button[aria-controls^="mobile-navigation-section-"]')
      .filter({ hasText: 'E2E Hybrid Hub with a deliberately long label' })
    await products.evaluate((button) => (button as HTMLButtonElement).click())
    const foundations = dialog.getByRole('button', { name: 'E2E Foundations' })
    await foundations.click()
    await expect(foundations).toHaveAttribute('aria-expanded', 'true')
    await hybrid.click()
    await expect(products).toHaveAttribute('aria-expanded', 'false')
    await expect(hybrid).toHaveAttribute('aria-expanded', 'true')
    await products.click()
    await expect(foundations).toHaveAttribute('aria-expanded', 'false')
    await dialog.getByRole('button', { name: 'Close navigation' }).click()
    await expect(dialog).toBeHidden()

    await openButton.click()
    await expect.poll(() => rootPanel.evaluate((panel) => panel.scrollTop)).toBe(0)
    await expect(products).toHaveAttribute('aria-expanded', 'false')
    await expect(hybrid).toHaveAttribute('aria-expanded', 'false')
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
    await expect(chevron).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)')
    await expectNoProductionDomainRequests(page)
  })
})
