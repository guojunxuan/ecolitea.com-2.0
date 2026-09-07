import { expect, type Page, test, type TestInfo } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'

const baseURL = 'http://localhost:3000'
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
  const social = await payload.create({
    collection: 'social-platforms',
    data: { icon: logo.id, platform: 'E2E LinkedIn' },
    ...disableRevalidate,
  })
  const routePage = bySlug[slugs.route]!
  const directPage = bySlug[slugs.direct]!

  const productDropdown = {
    description: 'Deterministic E2E product navigation.',
    descriptionLinks: [{ link: customLink('E2E Product overview', '/e2e-product-overview') }],
    items: [
      {
        type: 'default' as const,
        defaultItem: {
          description: 'A direct second-level destination.',
          link: {
            label: 'E2E Default destination',
            reference: { relationTo: 'pages' as const, value: routePage.id },
            type: 'reference' as const,
          },
        },
      },
      {
        type: 'featured' as const,
        featuredItem: {
          landingLink: unlabeledLink('/e2e-featured-all'),
          links: [{ link: customLink('E2E Featured detail', '/e2e-featured-detail') }],
          tag: 'E2E Featured group',
        },
      },
      {
        type: 'list' as const,
        listItem: {
          landingLink: unlabeledLink('/e2e-list-all'),
          links: [{ link: customLink('E2E List detail', '/e2e-list-detail') }],
          tag: 'E2E List group',
        },
      },
    ],
  }

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
        { dropdown: productDropdown, label: 'E2E Products', navigationType: 'dropdown' },
        {
          dropdown: {
            description: 'Hybrid navigation fixture.',
            items: [
              {
                defaultItem: { link: customLink('E2E Hybrid child', '/e2e-hybrid-child') },
                type: 'default' as const,
              },
            ],
          },
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
  await expect(brand.getByRole('img', { name: 'E2E website shell logo' })).toBeVisible()

  const social = page.locator('[data-footer-content="social"]')
  await expect(social.getByRole('link', { name: 'E2E LinkedIn' })).toHaveAttribute(
    'href',
    'https://example.com/e2e-linkedin',
  )
  await expect(social.locator('img')).toBeVisible()

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
  await expect(dialog).toHaveAttribute('data-level', '1')
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  const viewport = page.viewportSize()!
  expect(await dialog.boundingBox()).toEqual({
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  })

  const products = dialog.getByRole('button', { name: 'Open E2E Products' })
  await products.click()
  await expect(dialog).toHaveAttribute('data-level', '2')
  const featured = dialog.getByRole('button', { name: 'Open E2E Featured group' })
  await featured.click()
  await expect(dialog).toHaveAttribute('data-level', '3')
  const levelThreeHeading = dialog.getByRole('heading', { name: 'E2E Featured group' })
  await expect(levelThreeHeading).toBeVisible()
  await expect
    .poll(async () => (await levelThreeHeading.boundingBox())?.x ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(48)
  await shot(page, testInfo, 'mobile-level-3')
  await dialog.getByRole('button', { name: 'Back to E2E Products' }).click()
  await expect(featured).toBeFocused()
  await dialog.getByRole('button', { name: 'Back to Navigation' }).click()
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
  await dialog.getByRole('link', { name: 'E2E Default destination' }).click()
  await expect(page).toHaveURL(`${baseURL}${routePath}`)
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
  const control = page.getByRole('button', { name })
  if (!(await control.isVisible())) await page.getByRole('button', { name: 'More menu' }).click()
  return control
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

  for (const width of [1170, 1440]) {
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
      await expect(page.getByRole('link', { name: 'E2E Default destination' })).toBeVisible()
      await shot(page, testInfo, 'desktop-mega-menu')
      await page.keyboard.press('Escape')

      const hybridButton = await exposeDesktopControl(page, 'E2E Hybrid Hub menu')
      const before = page.url()
      await hybridButton.click()
      await expect(page).toHaveURL(before)
      await expect(page.getByRole('region', { name: 'E2E Hybrid Hub menu' })).toBeVisible()
      await page.keyboard.press('Escape')
      const hybridLink = page.getByRole('link', { name: 'E2E Hybrid Hub', exact: true })
      if (!(await hybridLink.isVisible()))
        await page.getByRole('button', { name: 'More menu' }).click()
      await hybridLink.click()
      await expect(page).toHaveURL(`${baseURL}${routePath}`)

      const footer = page.getByRole('navigation', { name: 'Footer' })
      await expect(footer.locator('section')).toHaveCount(4)
      await expect(footer.locator('section').first().getByRole('button')).toBeHidden()
      await expect(footer.locator('section').first().locator('h2')).toBeVisible()
    })
  }
})
