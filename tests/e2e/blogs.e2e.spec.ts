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

  test('progressive listing appends the second page on scroll', async ({ page }) => {
    await page.goto(`${baseURL}/blogs`)
    const cards = page.locator('[data-slot="archive-item"]')
    await expect(cards).toHaveCount(12)
    const response = page.waitForResponse((response) =>
      response.url().includes('/api/public-blog-list?page=2'),
    )
    await page.getByRole('button', { name: 'Load more', exact: true }).scrollIntoViewIfNeeded()
    expect((await response).ok()).toBe(true)
    await expect(cards).toHaveCount(14)
    await expect(page.getByText("You've reached the end.")).toBeVisible()
    await expect(page.getByText('Showing 1 - 14 of 14 Blogs')).toBeVisible()
    await expect(page).toHaveURL(`${baseURL}/blogs`)
  })

  test('progressive listing retains cards on error and retries', async ({ page }) => {
    await page.route('**/api/public-blog-list?*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      }),
    )
    await page.goto(`${baseURL}/blogs`)
    await page.getByRole('button', { name: 'Load more', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByText('Failed to load more blogs.')).toBeVisible()
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(12)
    await page.unroute('**/api/public-blog-list?*')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(14)
    await expect(page.getByText("You've reached the end.")).toBeVisible()
  })

  test('quick filters restore author and custom dates through browser history', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${baseURL}/blogs`)
    const panel = page.getByRole('complementary', { name: 'Blog filters' })
    await panel.getByRole('checkbox', { name: 'Tea Editor', exact: true }).check()
    await panel.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('custom')
    await panel.getByLabel('From', { exact: true }).fill('2025-06-01')
    await panel.getByLabel('To', { exact: true }).fill('2025-06-01')
    await panel.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('title-desc')
    await panel.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(
      /author=.+&dateRange=custom&dateFrom=2025-06-01&dateTo=2025-06-01&sort=title-desc$/,
    )
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(1)
    await expect(
      page.getByRole('link', { name: 'The art of brewing thoughtful tea', exact: true }),
    ).toBeVisible()
    const appliedURL = page.url()
    await page.reload()
    await expect(panel.getByRole('checkbox', { name: 'Tea Editor', exact: true })).toBeChecked()
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(1)
    await panel.getByRole('button', { name: 'Reset all' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs`)
    await page.goBack()
    await expect(page).toHaveURL(appliedURL)
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(1)
    await page.goForward()
    await expect(page).toHaveURL(`${baseURL}/blogs`)
    await expect(panel.getByRole('checkbox', { name: 'Tea Editor', exact: true })).not.toBeChecked()
  })

  test('quick filters use canonical categories and preserve sorting while loading more', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${baseURL}/blogs?sort=oldest`)
    await expect(page.locator('[data-slot="content-card-title"]').first()).toHaveText(
      'Tea journal 01',
    )
    const request = page.waitForResponse((response) =>
      response.url().includes('/api/public-blog-list?page=2&sort=oldest'),
    )
    await page.getByRole('button', { name: 'Load more', exact: true }).scrollIntoViewIfNeeded()
    expect((await request).ok()).toBe(true)
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(14)
    const panel = page.getByRole('complementary', { name: 'Blog filters' })
    await panel.getByRole('radio', { name: 'Brewing (12)', exact: true }).check()
    await panel.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs/category/${fixture.prefix}-brewing?sort=oldest`)
    await expect(
      page
        .getByRole('navigation', { name: 'Blog categories' })
        .locator('a[aria-current="page"]:visible'),
    ).toHaveText('Brewing 12')
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(12)
  })

  test('quick filters show empty preset results and retry failed later requests', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/blogs?dateRange=7d`)
    await expect(page.getByText('No blogs found.', { exact: true })).toBeVisible()
    await page.goto(`${baseURL}/blogs?sort=oldest`)
    await expect(page.locator('[data-slot="content-card-title"]').first()).toHaveText('Tea journal 01')
    await page.route('**/api/public-blog-list?*', (route) =>
      route.fulfill({ status: 500, body: '{}', contentType: 'application/json' }),
    )
    await page.getByRole('button', { name: 'Load more', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByText('Failed to load more blogs.', { exact: true })).toBeVisible()
    await page.unroute('**/api/public-blog-list?*')
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(14)
  })

  test('direct filtered URLs render the correct cards without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    try {
      const page = await context.newPage()
      await page.goto(`${baseURL}/blogs?sort=oldest`)
      await expect(page.locator('[data-slot="content-card-title"]').first()).toHaveText('Tea journal 01')
      await expect(page.getByRole('combobox', { name: 'Sort by' }).first()).toHaveValue('oldest')
    } finally {
      await context.close()
    }
  })

  test('mobile quick filters open and close with the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${baseURL}/blogs`)
    const trigger = page.getByRole('button', { name: 'Filters', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Filters' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close filters' })).toBeFocused()
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
    await page.keyboard.press('Enter')
    await dialog.getByRole('combobox', { name: 'Sort by' }).selectOption('oldest')
    await dialog.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs?sort=oldest`)
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('[data-slot="content-card-title"]').first()).toHaveText(
      'Tea journal 01',
    )
  })

  test('skip links move keyboard focus to main content and an available TOC', async ({ page }) => {
    await page.goto(`${baseURL}/blogs`)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#main-content')).toBeFocused()
    await expect(page).toHaveURL(/#main-content$/)

    await page.goto(`${baseURL}/blogs/${fixture.slug}`)
    const main = page.locator('main#main-content')
    const contentLink = page.getByRole('link', { name: 'Skip to content' })
    await page.keyboard.press('Tab')
    await expect(contentLink).toBeFocused()
    await expect(contentLink).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(main).toBeFocused()
    await expect(page).toHaveURL(/#main-content$/)
    await expect(page.locator('#main-content')).toHaveCount(1)

    const tocLink = page.getByRole('link', { name: 'Skip to table of contents' })
    await page.keyboard.press('Tab')
    await expect(tocLink).toBeFocused()
    await expect(tocLink).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#table-of-contents')).toBeFocused()
    await expect(page).toHaveURL(/#table-of-contents$/)
    await expect(page.locator('#table-of-contents')).toHaveCount(1)

    await page.goto(`${baseURL}/blogs/${fixture.prefix}-1`)
    await expect(page.getByRole('link', { name: 'Skip to table of contents' })).toHaveCount(0)
    await expect(page.locator('#table-of-contents')).toHaveCount(0)
  })

  test('blog archive cards animate with bounded stagger and respect reduced motion', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/blogs`)
    const cards = page.locator('[data-slot="archive-item"]')
    await expect(cards).toHaveCount(12)

    const motion = await cards.evaluateAll((items) =>
      items.map((item) => {
        const style = getComputedStyle(item)
        return {
          name: style.animationName,
          duration: style.animationDuration,
          delay: style.animationDelay,
        }
      }),
    )
    expect(motion[0].name).not.toBe('none')
    expect(motion.every(({ name }) => name === motion[0].name)).toBe(true)
    expect(motion[0]).toMatchObject({ duration: '0.4s', delay: '0s' })
    expect(motion[1].delay).toBe('0.08s')
    expect(motion[11].delay).toBe('0.88s')

    await page.getByRole('link', { name: 'Go to next page' }).click()
    const paginatedCards = page.locator('[data-slot="archive-item"]')
    await expect(paginatedCards).toHaveCount(2)
    const paginatedMotion = await paginatedCards.evaluateAll((items) =>
      items.map((item) => getComputedStyle(item).animationName),
    )
    expect(paginatedMotion[0]).not.toBe('none')
    expect(paginatedMotion[1]).toBe(paginatedMotion[0])

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect
      .poll(() =>
        paginatedCards.evaluateAll((items) =>
          items.map((item) => getComputedStyle(item).animationName),
        ),
      )
      .toEqual(['none', 'none'])
  })

  test('listing order, featured card, pagination, and category breadcrumbs', async ({ page }) => {
    await page.goto(`${baseURL}/blogs`)
    await expect(page.getByRole('heading', { name: 'Blogs', exact: true })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Blog categories' })
    await expect(nav.getByRole('link', { name: /^All \d+$/ })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Brewing 12' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Sourcing 1' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Culture 1' })).toBeVisible()
    await expect(nav.locator('a[aria-current="page"]:visible')).toHaveText(/^All \d+$/)
    await expect(page.locator('[data-featured="true"]')).toContainText(
      'The art of brewing thoughtful tea',
    )
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(12)
    const category = page.locator('[data-slot="content-card-category"]').first()
    const pillStyles = await category.evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        paddingInline: styles.paddingInline,
      }
    })
    expect(pillStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(parseFloat(pillStyles.paddingInline)).toBeGreaterThan(0)
    expect(pillStyles.color).toBe('rgb(38, 38, 41)')

    for (let tab = 0; tab < 30; tab += 1) {
      if (await category.evaluate((element) => element === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await expect(category).toBeFocused()
    const focusOutline = await category.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    )
    expect(focusOutline).not.toBe('none')

    await category.hover()
    await expect(category).toHaveCSS('background-color', 'rgb(10, 10, 10)')
    await expect(category).toHaveCSS('color', 'rgb(255, 255, 255)')

    const inverseCategory = page.locator('[data-slot="content-card-category"]').nth(1)
    await inverseCategory.evaluate((element) =>
      element.setAttribute('data-website-theme', 'inverse'),
    )
    await expect(inverseCategory).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.12)')
    await expect(inverseCategory).toHaveCSS('color', 'rgba(255, 255, 255, 0.85)')
    await page.getByRole('link', { name: 'Go to next page' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs/page/2`)
    expect(await page.locator('[data-slot="archive-item"]').count()).toBeGreaterThanOrEqual(2)
    await expect(page.locator('[data-featured="true"]')).toHaveCount(0)
    await page.getByRole('link', { name: 'Go to previous page' }).click()
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
      const category = page.locator('[data-slot="content-card-category"]').first()
      const columns = await archive
        .first()
        .evaluate(
          (item) => getComputedStyle(item.parentElement!).gridTemplateColumns.split(' ').length,
        )
      expect(columns).toBe(width >= 768 ? 2 : 1)
      if (width === 1440 || width === 390) {
        const pill = await category.evaluate((element) => {
          const styles = getComputedStyle(element)
          return {
            backgroundColor: styles.backgroundColor,
            paddingBlock: styles.paddingBlock,
            paddingInline: styles.paddingInline,
          }
        })
        expect(pill.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        expect(parseFloat(pill.paddingBlock)).toBeGreaterThan(0)
        expect(parseFloat(pill.paddingInline)).toBeGreaterThan(0)
      }
      await archive.evaluateAll(async (items) => {
        await Promise.all(
          items
            .slice(0, 2)
            .flatMap((item) => item.getAnimations().map((animation) => animation.finished)),
        )
      })
      const featured = await archive.first().boundingBox()
      const regular = await archive.nth(1).boundingBox()
      expect(featured).not.toBeNull()
      expect(regular).not.toBeNull()
      if (width >= 1024) {
        expect(featured!.y).toBeLessThan(regular!.y)
        expect(featured!.width).toBeGreaterThan(regular!.width * 1.9)
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
        const trigger = page.getByRole('button', { name: 'Open table of contents' })
        await trigger.focus()
        await page.keyboard.press('Enter')
        const drawer = page.getByRole('dialog', { name: 'Table of contents' })
        await expect(drawer).toBeVisible()
        if (width === 390) {
          await page.emulateMedia({ reducedMotion: 'no-preference' })
          expect(
            await drawer.evaluate((dialog) =>
              getComputedStyle(dialog)
                .transitionDuration.split(',')
                .some((duration) => parseFloat(duration) > 0),
            ),
          ).toBe(true)
          await page.emulateMedia({ reducedMotion: 'reduce' })
          expect(
            await drawer.evaluate((dialog) => getComputedStyle(dialog).transitionDuration),
          ).toBe('0s')
          expect(
            await drawer.evaluate(
              (dialog) => getComputedStyle(dialog, '::backdrop').transitionDuration,
            ),
          ).toBe('0s')
          await page.emulateMedia({ reducedMotion: 'no-preference' })
        }
        await expect(drawer.getByRole('button', { name: 'Close table of contents' })).toBeFocused()
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
        await page.keyboard.press('Escape')
        await expect(drawer).not.toBeVisible()
        await expect(trigger).toBeFocused()
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        await expect
          .poll(() => page.evaluate(() => document.body.style.overflow))
          .not.toBe('hidden')
        await trigger.click()
        await expect(drawer).toBeVisible()
      }
      const toc = page.locator('nav[aria-label="Table of contents"]:visible')
      const anchor = toc.getByRole('link', { name: 'Start with the leaf' })
      await expect(toc.getByRole('link', { name: fixture.longHeading })).toBeVisible()
      if (width >= 1024) {
        const geometry = await page
          .locator('[data-slot="blog-article-content"]')
          .evaluate((content) => {
            const prose = content.querySelector('.payload-richtext')!.getBoundingClientRect()
            const media = content.querySelector('figure')!.getBoundingClientRect()
            const cta = [...content.querySelectorAll('h2')]
              .find((heading) => heading.textContent === 'Find your next cup')!
              .parentElement!.parentElement!.getBoundingClientRect()
            return { prose: prose.width, media: media.width, cta: cta.width }
          })
        expect.soft(geometry.media, JSON.stringify(geometry)).toBeGreaterThan(geometry.prose + 30)
        expect.soft(geometry.cta, JSON.stringify(geometry)).toBeGreaterThan(geometry.prose + 30)
        await page
          .locator('#start-with-the-leaf')
          .evaluate((heading) =>
            window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY + 300),
          )
        await expect
          .poll(() =>
            anchor.evaluate((link) => {
              const rect = link.getBoundingClientRect()
              const headerHeight =
                parseFloat(
                  getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
                ) * parseFloat(getComputedStyle(document.documentElement).fontSize)
              return rect.top >= headerHeight
            }),
          )
          .toBe(true)
        await anchor.click({ trial: true })
      }
      await anchor.focus()
      await expect(anchor).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/#start-with-the-leaf$/)
      await expect(page.locator('#start-with-the-leaf')).toBeInViewport()
      if (width < 1024) {
        await expect(page.getByRole('dialog', { name: 'Table of contents' })).not.toBeVisible()
        await expect
          .poll(() => page.evaluate(() => document.body.style.overflow))
          .not.toBe('hidden')
      }
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
      await expect(page.getByRole('button', { name: 'Open table of contents' })).toHaveCount(0)
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
