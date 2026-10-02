import { expect, test } from '@playwright/test'
import path from 'node:path'
import { blogFixture, reportBlogEnvironment } from '../helpers/blogFixtures'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
const fixture = blogFixture(runID)
const baseURL = getE2EBaseURL()

test.describe('Blog publishing journeys', () => {
  test.beforeAll(() => reportBlogEnvironment(runID))
  test.beforeEach(async ({ page }) => {
    // Exercise UI with the exact local fixture; storage transport has its own suite.
    await page.route(`**/*${fixture.prefix}.png*`, (route) =>
      route.fulfill({
        path: path.resolve('media', `${fixture.prefix}.png`),
        contentType: 'image/png',
      }),
    )
  })

  test('listing order, featured card, pagination, and category breadcrumbs', async ({ page }) => {
    await page.goto(`${baseURL}/blogs`)
    await expect(page.getByRole('heading', { name: 'Blogs', exact: true })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Blog categories' })
    await expect(nav.locator('a:visible')).toHaveText([
      'All 14',
      'Brewing 12',
      'Sourcing 1',
      'Culture 1',
    ])
    await expect(nav.locator('a[aria-current="page"]:visible')).toHaveText('All 14')
    await expect(page.locator('[data-featured="true"]')).toContainText(
      'The art of brewing thoughtful tea',
    )
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(12)
    await page.getByRole('button', { name: 'Go to next page' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs/page/2`)
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(2)
    await expect(page.locator('[data-featured="true"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Go to previous page' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs`)
    await nav.getByRole('link', { name: 'Sourcing 1' }).click()
    await expect(page.getByRole('heading', { name: 'Sourcing Blogs' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
      'Blogs / Sourcing',
    )
    await expect(nav.locator('a[aria-current="page"]:visible')).toHaveText('Sourcing 1')
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(1)
  })

  for (const width of [1440, 1152, 768, 390]) {
    test(`article blocks, TOC, keyboard, related order, and geometry at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.goto(`${baseURL}/blogs`)
      await expect(page.getByRole('heading', { name: 'Blogs', exact: true })).toBeVisible()
      const archive = page.locator('[data-slot="archive-item"]')
      const columns = await archive
        .first()
        .evaluate(
          (item) => getComputedStyle(item.parentElement!).gridTemplateColumns.split(' ').length,
        )
      expect(columns).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1)
      const featured = await archive.first().boundingBox()
      const regular = await archive.nth(1).boundingBox()
      expect(featured).not.toBeNull()
      expect(regular).not.toBeNull()
      if (width >= 1024) {
        expect(Math.abs(featured!.y - regular!.y)).toBeLessThan(2)
        expect(featured!.width).toBeGreaterThan(regular!.width * 2)
      }
      if (width === 390) {
        const more = page.locator('summary', { hasText: 'More categories' })
        await more.focus()
        await expect(more).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('link', { name: 'Culture 1' }).last()).toBeVisible()
        await page.keyboard.press('Tab')
        await expect(page.getByRole('link', { name: 'Culture 1' }).last()).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('heading', { name: 'Culture Blogs' })).toBeVisible()
        await expect(
          page.locator('[data-slot="blog-mobile-tabs"] a[aria-current="page"]'),
        ).toHaveText('Culture 1')
        await page.goto(`${baseURL}/blogs`)
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await page.screenshot({
        path: testInfo.outputPath(`blogs-list-${width}.png`),
        fullPage: true,
      })
      await page.goto(`${baseURL}/blogs/${fixture.slug}`)
      await expect(
        page.getByRole('heading', { name: 'The art of brewing thoughtful tea', exact: true }),
      ).toBeVisible()
      await expect(page.getByText('Tea Editor', { exact: true }).last()).toBeVisible()
      const images = page.locator('main img')
      expect(await images.count()).toBeGreaterThanOrEqual(3)
      await expect
        .poll(() => images.first().evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0)
      for (const text of [
        'At a Glance',
        'Water temperature changes flavor.',
        'Leaves ready for brewing',
        'Brewing note',
        'Find your next cup',
      ]) {
        await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
      }
      await expect(page.getByRole('link', { name: 'Explore tea stories' })).toHaveAttribute(
        'href',
        '/blogs',
      )
      if (width < 1024) {
        await page.locator('summary', { hasText: 'On this page' }).focus()
        await page.keyboard.press('Enter')
      }
      const toc = page.locator('nav[aria-label="Table of contents"]:visible')
      const anchor = toc.getByRole('link', { name: 'Start with the leaf' })
      await anchor.focus()
      await expect(anchor).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/#start-with-the-leaf$/)
      await expect(page.locator('#start-with-the-leaf')).toBeInViewport()
      await expect(toc.getByRole('link', { name: fixture.longHeading })).toBeVisible()
      console.info(
        `Article ${width}px geometry: ${JSON.stringify(
          await page.evaluate(() => ({
            viewport: innerWidth,
            document: document.documentElement.scrollWidth,
            overflowing: [...document.querySelectorAll('main *')]
              .filter((element) => element.getBoundingClientRect().right > innerWidth)
              .map((element) => element.tagName + '.' + element.className),
          })),
        )}`,
      )
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await expect(page.getByRole('region', { name: 'More to read' }).locator('h3')).toHaveText([
        'Tea journal 05',
        'Tea journal 02',
        'Tea journal 10',
      ])
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: testInfo.outputPath(`blogs-detail-${width}.png`),
        fullPage: true,
      })
      await page.goto(`${baseURL}/blogs/${fixture.prefix}-1`)
      await expect(page.getByRole('heading', { name: 'Tea journal 01', exact: true })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Table of contents' })).toHaveCount(0)
      const readingColumn = await page.locator('[data-slot="blog-article-content"]').boundingBox()
      expect(readingColumn).not.toBeNull()
      expect(Math.abs(readingColumn!.x + readingColumn!.width / 2 - width / 2)).toBeLessThan(2)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await page.screenshot({
        path: testInfo.outputPath(`blogs-no-toc-${width}.png`),
        fullPage: true,
      })
    })
  }

  test('draft/future visibility, sitemap, robots, and authenticated draft preview', async ({
    page,
    request,
  }) => {
    for (const status of ['draft', 'future']) {
      const response = await request.get(`${baseURL}/blogs/${fixture.prefix}-${status}`)
      expect(response.status()).toBe(404)
      const listing = await request.get(
        `${baseURL}/api/blogs?where[slug][equals]=${fixture.prefix}-${status}`,
      )
      expect((await listing.json()).docs).toEqual([])
    }
    const sitemap = await request.get(`${baseURL}/blogs-sitemap.xml`)
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain(`/blogs/${fixture.slug}`)
    expect(xml).not.toContain(`${fixture.prefix}-draft`)
    expect(xml).not.toContain(`${fixture.prefix}-future`)
    const robots = await request.get(`${baseURL}/robots.txt`)
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toContain('Sitemap:')
    const preview = `${baseURL}/next/preview?path=/blogs/${fixture.prefix}-draft&previewSecret=${process.env.PREVIEW_SECRET}`
    expect((await request.get(preview)).status()).toBe(403)
    const login = await page.request.post(`${baseURL}/api/users/login`, {
      data: { email: fixture.email, password: fixture.password },
    })
    expect(login.status()).toBe(200)
    await page.goto(preview)
    await expect(page).toHaveURL(`${baseURL}/blogs/${fixture.prefix}-draft`)
    await expect(page.getByRole('heading', { name: 'draft private tea story' })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await page.goto(`${baseURL}/next/exit-preview`)
    expect((await page.request.get(`${baseURL}/blogs/${fixture.prefix}-draft`)).status()).toBe(404)
  })
})
