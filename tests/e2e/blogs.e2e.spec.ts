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

  test('page-number navigation links to static listing pages', async ({ page }) => {
    await page.goto(`${baseURL}/blogs`)
    const cards = page.locator('[data-slot="archive-item"]')
    await expect(cards).toHaveCount(12)
    await expect(page.getByText(/^Showing /)).toHaveCount(0)
    await expect(page.getByText("You've reached the end.")).toHaveCount(0)
    const pagination = page.getByRole('navigation', { name: 'pagination' })
    await expect(pagination.locator('a[aria-current="page"]')).toHaveText('1')
    await expect(pagination.getByRole('link', { name: 'Go to previous page' })).toHaveCount(0)

    await pagination.getByRole('link', { name: '2', exact: true }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs/page/2`)
    await expect(cards).toHaveCount(2)
    await expect(pagination.locator('a[aria-current="page"]')).toHaveText('2')
    await expect(pagination.getByRole('link', { name: 'Go to next page' })).toHaveCount(0)

    await pagination.getByRole('link', { name: 'Go to previous page' }).click()
    await expect(page).toHaveURL(`${baseURL}/blogs`)
    await expect(cards).toHaveCount(12)
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
    expect(motion[11].delay).toBe('0.4s')

    await page.goto(`${baseURL}/blogs/page/2`)
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

  test('listing order, uniform cards, static page route, and category breadcrumbs', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/blogs`)
    await expect(page.getByRole('heading', { name: 'Blogs', exact: true })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Blog categories' })
    await expect(nav.getByRole('link', { name: 'All', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Brewing', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Sourcing', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Culture', exact: true }).first()).toBeVisible()
    await expect(nav.locator('a[aria-current="page"]:visible')).toHaveText('All')
    await expect(page.locator('[data-slot="archive-item"]').first()).toContainText(
      'The art of brewing thoughtful tea',
    )
    await expect(page.locator('[data-featured]')).toHaveCount(0)
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
    await expect(page.getByRole('link', { name: 'Go to next page' })).toHaveAttribute(
      'href',
      '/blogs/page/2',
    )
    const secondPage = await page.goto(`${baseURL}/blogs/page/2`)
    expect(secondPage?.status()).toBe(200)
    await expect(page).toHaveURL(`${baseURL}/blogs/page/2`)
    expect(await page.locator('[data-slot="archive-item"]').count()).toBeGreaterThanOrEqual(2)
    await page.goto(`${baseURL}/blogs`)
    await expect(page).toHaveURL(`${baseURL}/blogs`)
    await nav.getByRole('link', { name: 'Sourcing', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Sourcing Blogs' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
      'Blogs / Sourcing',
    )
    await expect(nav.locator('a[aria-current="page"]:visible')).toHaveText('Sourcing')
    await expect(page.locator('[data-slot="archive-item"]')).toHaveCount(1)
  })

  test('blog cards open the article from any card area while category links stay separate', async ({
    page,
  }) => {
    await page.goto(`${baseURL}/blogs`)
    const card = page.locator('[data-slot="content-card"]').first()
    const href = await card.locator('[data-slot="content-card-link"]').getAttribute('href')
    const excerpt = card.locator('[data-slot="content-card-description"]')
    const box = await excerpt.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(400)
    await page.mouse.up()
    await expect(page).toHaveURL(`${baseURL}${href}`)

    await page.goto(`${baseURL}/blogs`)
    const category = page.locator('[data-slot="content-card-category"]').first()
    const categoryHref = await category.getAttribute('href')
    await category.click()
    await expect(page).toHaveURL(`${baseURL}${categoryHref}`)
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
      expect(columns).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1)
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
      const first = await archive.first().boundingBox()
      const second = await archive.nth(1).boundingBox()
      expect(first).not.toBeNull()
      expect(second).not.toBeNull()
      expect(Math.abs(first!.width - second!.width)).toBeLessThan(1)
      if (width >= 768) expect(Math.abs(first!.y - second!.y)).toBeLessThan(1)
      if (width === 390) {
        const menu = page.locator('[data-slot="blog-mobile-menu"]')
        const trigger = menu.locator('summary')
        await expect(trigger).toHaveText('All')
        await trigger.focus()
        await expect(trigger).toBeFocused()
        await page.keyboard.press('Enter')
        const culture = menu.getByRole('link', { name: 'Culture', exact: true })
        await expect(culture).toBeVisible()
        await culture.focus()
        await expect(culture).toBeFocused()
        await culture.press('Enter')
        await expect(page.getByRole('heading', { name: 'Culture Blogs' })).toBeVisible()
        await expect(menu).not.toHaveAttribute('open')
        await expect(trigger).toHaveText('Culture')
        await trigger.click()
        await expect(menu.locator('a[aria-current="page"]')).toHaveText('Culture')
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
        const trigger = page.getByRole('button', { name: 'Table of contents', exact: true })
        await trigger.focus()
        await page.keyboard.press('Enter')
        // The desktop list is hidden below 64rem, so the visible TOC nav is the dropdown panel.
        const menu = page.locator('nav[aria-label="Table of contents"]:visible')
        await expect(menu).toBeVisible()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        if (width === 390) {
          const chevron = trigger.locator('svg')
          await page.emulateMedia({ reducedMotion: 'no-preference' })
          expect(
            await chevron.evaluate((icon) => parseFloat(getComputedStyle(icon).transitionDuration)),
          ).toBeGreaterThan(0)
          await page.emulateMedia({ reducedMotion: 'reduce' })
          await expect(chevron).toHaveCSS('transition-duration', '0s')
          await page.emulateMedia({ reducedMotion: 'no-preference' })
        }
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        const barBox = await trigger.locator('..').boundingBox()
        const menuBox = await menu.boundingBox()
        expect(Math.abs(menuBox!.y - (barBox!.y + barBox!.height))).toBeLessThan(2)
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
        await page.keyboard.press('Escape')
        await expect(menu).toHaveCount(0)
        await expect(trigger).toBeFocused()
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        await trigger.click()
        await expect(menu).toBeVisible()
      }
      const toc = page.locator('nav[aria-label="Table of contents"]:visible')
      const anchor = toc.getByRole('link', { name: 'Start with the leaf' })
      await expect(toc.getByRole('link', { name: fixture.longHeading })).toBeVisible()
      if (width >= 1024) {
        const geometry = await page
          .locator('[data-slot="blog-article-content"]')
          .evaluate((content) => {
            const prose = content.querySelector('.payload-richtext > p')!.getBoundingClientRect()
            const media = content.querySelector('figure')!.getBoundingClientRect()
            const cta = [...content.querySelectorAll('h2')]
              .find((heading) => heading.textContent === 'Find your next cup')!
              .parentElement!.parentElement!.getBoundingClientRect()
            return {
              prose: prose.width,
              media: media.width,
              cta: cta.width,
              content: content.getBoundingClientRect().width,
              left: content.getBoundingClientRect().x,
              proseLeft: prose.x,
              mediaLeft: media.x,
              ctaLeft: cta.x,
            }
          })
        expect(geometry.prose).toBeCloseTo(geometry.content, 0)
        expect(geometry.media).toBeCloseTo(geometry.content, 0)
        expect(geometry.cta).toBeCloseTo(geometry.content, 0)
        for (const left of [geometry.proseLeft, geometry.mediaLeft, geometry.ctaLeft]) {
          expect(Math.abs(left - geometry.left)).toBeLessThan(2)
        }

        await page
          .locator('#start-with-the-leaf')
          .evaluate((heading) =>
            window.scrollTo({
              top: heading.getBoundingClientRect().top + window.scrollY + 300,
              behavior: 'instant',
            }),
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
        await expect(page.getByRole('button', { name: 'Table of contents', exact: true })).toHaveAttribute(
          'aria-expanded',
          'false',
        )
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
      await expect(page.getByRole('button', { name: 'Table of contents', exact: true })).toHaveCount(0)
      const readingColumn = await page.locator('[data-slot="blog-article-content"]').boundingBox()
      expect(readingColumn).not.toBeNull()
      const articleColumn = await page.locator('main > article').boundingBox()
      expect(Math.abs(readingColumn!.x - articleColumn!.x)).toBeLessThan(2)
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

// This suite reads the current development article through the existing-server config.
// It uses local reference images and blocks external requests rather than contacting R2.
test.describe('Template A existing server', () => {
  test.skip(!process.env.BLOG_DETAIL_EXISTING_SERVER, 'Use playwright.blog-detail.config.ts')

  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        await route.continue()
      } else if (request.resourceType() === 'image') {
        if (url.pathname.endsWith('.svg')) {
          await route.fulfill({
            path: path.resolve('public/favicon.svg'),
            contentType: 'image/svg+xml',
          })
        } else {
          await route.fulfill({
            path: path.resolve('public/website-template-OG.webp'),
            contentType: 'image/webp',
          })
        }
      } else {
        await route.abort()
      }
    })
  })

  for (const width of [1440, 1152, 768, 390]) {
    test(`article alignment, reading width, wide blocks and sticky tools at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.goto(
        `/blogs/${process.env.BLOG_DETAIL_SLUG ?? 'small-details-better-everyday-products'}`,
      )
      const article = page.locator('main > article')
      const content = page.locator('[data-slot="blog-article-content"]')
      const heading = article.locator('h1')
      await expect(heading).toBeVisible()
      await expect(article.locator('header time')).toHaveText(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/)
      const geometry = await article.evaluate((element) => {
        const rect = (target: Element) => {
          const { x, y, width, height, right } = target.getBoundingClientRect()
          return { x, y, width, height, right }
        }
        const content = element.querySelector('[data-slot="blog-article-content"]')!
        const richText = content.querySelector('.payload-richtext')!
        const cta = [...richText.querySelectorAll('h2')]
          .find((item) => item.textContent === 'Find ideas for your next project')!
          .closest('.payload-richtext__embedded')!.firstElementChild!
        return {
          article: rect(element),
          header: rect(document.querySelector('header [data-scrolled]')!),
          breadcrumb: rect(element.querySelector('nav[aria-label="Breadcrumb"]')!),
          title: rect(element.querySelector('h1')!),
          excerpt: rect(element.querySelector('header > p')!),
          hero: rect(element.querySelector('header + div')!),
          content: rect(content),
          prose: rect(richText.querySelector(':scope > p')!),
          media: rect(richText.querySelector('figure')!),
          cta: rect(cta),
        }
      })
      console.info(`Template A ${width}px: ${JSON.stringify(geometry)}`)
      expect(geometry.breadcrumb.y - geometry.header.y - geometry.header.height).toBeCloseTo(
        width >= 1024 ? 56 : 40,
        0,
      )
      for (const key of [
        'breadcrumb',
        'title',
        'excerpt',
        'hero',
        'content',
        'prose',
        'media',
        'cta',
      ] as const) {
        expect(Math.abs(geometry[key].x - geometry.article.x), key).toBeLessThan(2)
      }
      expect(geometry.article.width).toBeLessThanOrEqual(1220)
      expect(geometry.title.width).toBeCloseTo(geometry.article.width, 0)
      expect(geometry.excerpt.width).toBeCloseTo(geometry.article.width, 0)
      expect(geometry.hero.width).toBeCloseTo(geometry.article.width, 0)
      expect(geometry.prose.width).toBeCloseTo(geometry.content.width, 0)
      expect(geometry.media.width).toBeCloseTo(geometry.content.width, 0)
      expect(geometry.cta.width).toBeCloseTo(geometry.content.width, 0)

      const ratio = width >= 768 ? 2 / 1 : 16 / 9
      expect(geometry.hero.width / geometry.hero.height).toBeCloseTo(ratio, 1)
      const trigger = page.getByRole('button', { name: 'Table of contents' })
      if (width < 1024) {
        await expect(trigger).toBeVisible()
        await expect(trigger).toContainText('On this page')
        await expect(trigger).toContainText('Designed around real routines')
        await content.locator('h2[id]').first().evaluate((heading) => {
          heading.scrollIntoView({ behavior: 'instant', block: 'start' })
        })
        const barGeometry = await trigger.evaluate((button) => {
          const bar = button.parentElement!
          const box = bar.getBoundingClientRect()
          return {
            x: box.x,
            right: box.right,
            top: box.top,
            height: box.height,
            header:
              parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
              ) * 16,
          }
        })
        expect(Math.abs(barGeometry.x)).toBeLessThan(2)
        expect(Math.abs(barGeometry.right - width)).toBeLessThan(2)
        expect(barGeometry.height).toBeGreaterThanOrEqual(48)
        expect(Math.abs(barGeometry.top - barGeometry.header)).toBeLessThan(2)
        await trigger.focus()
        await trigger.press('Enter')
        const menu = page.locator('nav[aria-label="Table of contents"]:visible')
        await expect(menu).toBeVisible()
        const menuBox = await menu.boundingBox()
        expect(Math.abs(menuBox!.x)).toBeLessThan(2)
        expect(Math.abs(menuBox!.width - width)).toBeLessThan(2)
        expect(Math.abs(menuBox!.y - (barGeometry.top + barGeometry.height))).toBeLessThan(2)
        await page.keyboard.press('Escape')
        await expect(menu).toHaveCount(0)
        await expect(trigger).toBeFocused()
        await trigger.click()
        await menu.getByRole('link', { name: 'Materials that feel right' }).click()
        await expect(menu).toHaveCount(0)
        await expect(page).toHaveURL(/#materials-that-feel-right$/)
        const currentHeading = await content.locator('h2[id], h3[id]').evaluateAll((headings) => {
          const passed = headings.filter(
            (heading) => heading.getBoundingClientRect().top <= innerHeight * 0.3,
          )
          return (passed.at(-1) ?? headings[0])?.textContent ?? ''
        })
        await expect(trigger).toContainText(currentHeading)
        await trigger.click()
        await expect(menu).toBeVisible()
        await content.locator('p').last().dispatchEvent('pointerdown')
        await expect(menu).toHaveCount(0)
      } else {
        await expect(trigger).not.toBeVisible()
        const toc = page.locator('nav[aria-label="Table of contents"]:visible')
        const tocBox = await toc.boundingBox()
        expect(tocBox!.width).toBeCloseTo(280, 0)
        expect(tocBox!.x + tocBox!.width).toBeCloseTo(geometry.article.right, 0)
        expect(tocBox!.y).toBeCloseTo(geometry.content.y, 0)
        const firstSection = content.locator('h2[id]').first()
        await firstSection.evaluate((heading) =>
          window.scrollTo(
            0,
            heading.getBoundingClientRect().top + scrollY - innerHeight * 0.3 + 20,
          ),
        )
        await expect(toc.locator('a[aria-current="location"]')).toHaveText(
          (await firstSection.textContent()) ?? '',
        )
        const lastSection = content.locator('h2[id]').last()
        await lastSection.evaluate((heading) =>
          window.scrollTo(
            0,
            heading.getBoundingClientRect().top + scrollY - innerHeight * 0.3 + 20,
          ),
        )
        await expect(toc.locator('a[aria-current="location"]')).toHaveText(
          (await lastSection.textContent()) ?? '',
        )
        await expect
          .poll(() =>
            toc.evaluate((nav) => {
              const top = nav.getBoundingClientRect().top
              const offset =
                parseFloat(
                  getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
                ) *
                  16 +
                24
              return Math.abs(top - offset) < 2
            }),
          )
          .toBe(true)
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      if (width === 390) {
        const longCategory = await page
          .locator('nav[aria-label="Breadcrumb"] a[href^="/blogs/category/"]')
          .evaluate((link) => {
            const text = link.textContent
            link.textContent =
              'A considerably longer unrestricted category title with an unbroken identifier ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            const result = { viewport: innerWidth, document: document.documentElement.scrollWidth }
            link.textContent = text
            return result
          })
        expect(longCategory.document).toBeLessThanOrEqual(longCategory.viewport)
      }
      const skipTOC = page.getByRole('link', { name: 'Skip to table of contents' })
      await skipTOC.focus()
      await skipTOC.press('Enter')
      await expect(page.locator('#table-of-contents')).toBeFocused()
      await expect(page.locator('#table-of-contents')).toBeVisible()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: testInfo.outputPath(`template-a-${width}.png`),
        fullPage: true,
      })
    })
  }
})
