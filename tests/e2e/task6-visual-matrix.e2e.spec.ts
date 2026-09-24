import { expect, type Page, test, type TestInfo } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from '../helpers/e2eDatabase'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const baseURL = getE2EBaseURL()
const runID = process.env.PLAYWRIGHT_E2E_RUN_ID!
const pageSlug = `e2e-task6-matrix-${runID}`
const postPrefix = `e2e-task6-matrix-${runID}-post-`
const postHeroSlug = `${postPrefix}banners`
const bannerQuery = 'banners'
const mediaAlt = `E2E Task6 matrix media ${runID}`
const formTitle = `E2E Task6 matrix form ${runID}`
const bannerCopy = {
  info: `Planned maintenance is scheduled for Saturday morning. https://example.invalid/${'unbroken-banner-token-'.repeat(12)}`,
  success: 'Your preferences were saved successfully.',
  warning: 'This option will be retired in a future release.',
  error: 'We could not process this request.',
} as const
const mediaOrigin = 'https://media.example.invalid'
const disableRevalidate = { context: { disableRevalidate: true } }
const pagePath = `/${pageSlug}`
const imagePNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
let payload: Payload

const text = (value: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
})
const paragraph = (value: string) => ({
  children: [text(value)],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})
const richText = (children: unknown[]) =>
  ({
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as never

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number)
    if (!channels || channels.length !== 3)
      throw new Error(`Unable to parse computed color ${color}`)
    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
  }
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

function contentRichText() {
  const longURL = `https://example.invalid/${'非常に長いURL-'.repeat(18)}segment`
  return richText([
    {
      children: [text('E2E long CJK heading — 中文标题与跨断点换行')],
      direction: 'ltr',
      format: '',
      indent: 0,
      tag: 'h2',
      type: 'heading',
      version: 1,
    },
    paragraph('中文正文与 English copy on a mixed-script line for responsive rhythm.'),
    {
      children: [
        {
          children: [text('First list item')],
          checked: false,
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'listitem',
          value: 1,
          version: 1,
        },
        {
          children: [text('Second list item')],
          checked: false,
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'listitem',
          value: 2,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      listType: 'bullet',
      start: 1,
      tag: 'ul',
      type: 'list',
      version: 1,
    },
    {
      children: [text('A quote block keeps its own vertical rhythm.')],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'quote',
      version: 1,
    },
    {
      children: [
        text('Long URL: '),
        {
          children: [text(longURL)],
          direction: 'ltr',
          fields: { linkType: 'custom', newTab: true, url: longURL },
          format: '',
          indent: 0,
          type: 'link',
          version: 3,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      textStyle: '',
      type: 'paragraph',
      version: 1,
    },
    {
      children: [
        {
          children: [
            {
              children: [
                {
                  children: [text('Scrollable header')],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  type: 'paragraph',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              headerState: 1,
              indent: 0,
              type: 'tablecell',
              version: 1,
            },
            {
              children: [
                {
                  children: [text('Second column')],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  type: 'paragraph',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              headerState: 1,
              indent: 0,
              type: 'tablecell',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'tablerow',
          version: 1,
        },
        {
          children: [
            {
              children: [
                {
                  children: [text('First row')],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  type: 'paragraph',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              headerState: 0,
              indent: 0,
              type: 'tablecell',
              version: 1,
            },
            {
              children: [
                {
                  children: [text('W'.repeat(180))],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  type: 'paragraph',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              headerState: 0,
              indent: 0,
              type: 'tablecell',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'tablerow',
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'table',
      version: 1,
    },
  ])
}

async function cleanupFixtures() {
  if (!payload) return
  assertRunScopedE2EDatabaseURI(process.env.DATABASE_URI!, runID)
  await payload.delete({
    collection: 'pages',
    where: { slug: { equals: pageSlug } },
    ...disableRevalidate,
  })
  await payload.delete({
    collection: 'posts',
    where: { slug: { like: `${postPrefix}%` } },
    ...disableRevalidate,
  })
  await payload.delete({
    collection: 'forms',
    where: { title: { equals: formTitle } },
    ...disableRevalidate,
  })
  await payload.delete({
    collection: 'media',
    where: { alt: { equals: mediaAlt } },
    ...disableRevalidate,
  })
}

async function seedFixtures() {
  await cleanupFixtures()
  const media = await payload.create({
    collection: 'media',
    data: { alt: mediaAlt },
    file: {
      data: imagePNG,
      mimetype: 'image/png',
      name: `task6-${runID}.png`,
      size: imagePNG.byteLength,
    },
    ...disableRevalidate,
  })
  if (!media.url?.startsWith(mediaOrigin))
    throw new Error('Expected run-scoped local S3 fixture URL.')

  const form = await payload.create({
    collection: 'forms',
    data: {
      title: formTitle,
      fields: [
        { blockType: 'text', label: 'Name', name: 'name', required: true, width: 100 },
        { blockType: 'email', label: 'Email', name: 'email', required: true, width: 100 },
        {
          blockType: 'checkbox',
          label: 'I agree to the terms',
          name: 'consent',
          required: true,
          width: 100,
        },
        {
          blockType: 'select',
          label: 'Region',
          name: 'region',
          options: [
            { label: 'Asia', value: 'asia' },
            { label: 'Europe', value: 'europe' },
          ],
          required: true,
          width: 100,
        },
      ],
      submitButtonLabel: 'Send request',
      confirmationType: 'message',
      confirmationMessage: richText([paragraph('Thank you for your request.')]),
    },
    ...disableRevalidate,
  })
  console.log(`Task6 matrix form created: ${form.id}`)

  console.log(`Task6 matrix page create: ${pageSlug}`)
  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      hero: {
        headerTheme: 'dark',
        type: 'mediumImpact',
        media: media.id,
        richText: richText([
          {
            children: [text('E2E Medium Hero visual matrix')],
            direction: 'ltr',
            format: '',
            indent: 0,
            tag: 'h1',
            type: 'heading',
            version: 1,
          },
          paragraph('Representative medium hero copy over controlled media.'),
        ]),
        links: [],
      },
      layout: [
        {
          blockType: 'content',
          columns: [{ size: 'full', richText: contentRichText() }],
        },
        { blockType: 'mediaBlock', media: media.id },
        { blockType: 'formBlock', form: form.id, enableIntro: false },
        { blockType: 'archive', populateBy: 'collection', relationTo: 'posts', limit: 3 },
      ],
      slug: pageSlug,
      title: `E2E Task6 Matrix ${runID}`,
    },
    ...disableRevalidate,
  })

  console.log(`Task6 matrix banner post create: ${postHeroSlug}`)
  const bannerNodes = (['info', 'success', 'warning', 'error'] as const).map((style) => ({
    fields: {
      blockType: 'banner',
      content: richText([paragraph(bannerCopy[style])]),
      id: `banner-${style}-${runID}`,
      style,
    },
    format: '',
    type: 'block',
    version: 1,
  }))
  await payload.create({
    collection: 'posts',
    data: {
      _status: 'published',
      content: richText([paragraph('E2E Banner status matrix.'), ...bannerNodes]),
      meta: { image: media.id, title: `E2E Banner matrix ${runID}` },
      slug: postHeroSlug,
      title: `E2E Banner matrix ${runID}`,
    },
    ...disableRevalidate,
  })
  await Promise.all(
    Array.from({ length: 13 }, (_, index) =>
      payload.create({
        collection: 'posts',
        data: {
          _status: 'published',
          content: richText([paragraph(`Archive card body ${index + 1}`)]),
          meta: {
            image: media.id,
            title: `E2E Matrix Archive ${String(index + 1).padStart(2, '0')}`,
          },
          slug: `${postPrefix}${String(index + 1).padStart(2, '0')}`,
          title: `E2E Matrix Archive ${String(index + 1).padStart(2, '0')}`,
        },
        ...disableRevalidate,
      }),
    ),
  )
}

async function preparePage(
  page: Page,
  width: number,
  height: number,
  options: { failMedia?: boolean } = {},
) {
  const imageRequests: string[] = []
  await page.route(`${mediaOrigin}/**`, async (route) => {
    imageRequests.push(route.request().url())
    if (options.failMedia) return route.abort('failed')
    await route.fulfill({
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      contentType: 'image/svg+xml',
    })
  })
  ;(page as Page & { matrixImageRequests?: string[] }).matrixImageRequests = imageRequests
  await page.setViewportSize({ width, height })
  await page.goto(`${baseURL}${pagePath}`)
  await expect(page.getByRole('heading', { name: 'E2E Medium Hero visual matrix' })).toBeVisible()
  return imageRequests
}

async function save(page: Page, testInfo: TestInfo, label: string) {
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`task6-${page.viewportSize()?.width}-${label}.png`),
  })
}

test.describe.serial('Task 6 visual matrix fixtures', () => {
  test.setTimeout(180_000)
  test.beforeAll(async () => {
    payload = await getPayload({ config })
    await seedFixtures()
  })
  test.afterAll(async () => cleanupFixtures())

  test('Medium Hero, rich content, embedded media, and table scrolling at key widths', async ({
    page,
  }, testInfo) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await preparePage(page, viewport.width, viewport.height)
      await expect(page.locator('[data-hero="medium-impact"]')).not.toHaveAttribute(
        'data-website-theme',
        'inverse',
      )
      await expect(
        page.getByRole('heading', { name: 'E2E long CJK heading — 中文标题与跨断点换行' }),
      ).toBeVisible()
      await expect(page.locator('main')).toContainText('First list item')
      await expect(page.locator('blockquote')).toContainText('A quote block')
      await expect(page.getByRole('region', { name: 'Scrollable table' })).toBeVisible()
      await expect(page.locator('main [class*="archive"] article')).toHaveCount(3)
      await expect(page.locator('a[href*="example.invalid"]')).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      const table = page.getByRole('region', { name: 'Scrollable table' })
      await table.focus()
      await page.keyboard.press('ArrowRight')
      const metrics = await table.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollLeft: element.scrollLeft,
        tabIndex: element.tabIndex,
      }))
      expect(metrics.tabIndex).toBe(0)
      console.log(`RichText table at ${viewport.width}px: ${JSON.stringify(metrics)}`)
      expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
      await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      const media = page.locator('[data-block-type="mediaBlock"] img, main img').last()
      await expect(media).toBeVisible()
      await expect
        .poll(() => media.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0)
      if ([390, 1440].includes(viewport.width)) await save(page, testInfo, 'rich-content')
    }
  })

  test('media failure preserves document geometry; form states and controls are inspectable', async ({
    page,
  }, testInfo) => {
    await preparePage(page, 390, 844, { failMedia: true })
    const failedImage = page.locator('main img').last()
    await expect
      .poll(() => failedImage.evaluate((image) => (image as HTMLImageElement).complete))
      .toBe(true)
    expect(await failedImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(0)
    await expect(failedImage).toHaveAttribute('alt', mediaAlt)
    await expect(
      page.getByRole('heading', { name: 'E2E long CJK heading — 中文标题与跨断点换行' }),
    ).toBeVisible()
    const form = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Send request' }) })
    await expect(form.getByLabel('Name')).toBeVisible()
    await expect(form.getByLabel('Email')).toBeVisible()
    await expect(form.getByLabel('I agree to the terms')).toBeVisible()
    await expect(form.getByLabel('Region')).toBeVisible()
    const targetSizes = await form.locator('input, select, button').evaluateAll((controls) =>
      controls
        .map((control) => {
          const rect = control.getBoundingClientRect()
          return {
            name: (control as HTMLInputElement).name,
            height: rect.height,
            width: rect.width,
          }
        })
        .filter(({ height, width }) => height >= 40 && width >= 40),
    )
    console.log(`Form target measurements: ${JSON.stringify(targetSizes)}`)
    expect(targetSizes.every(({ height, width }) => height >= 44 && width >= 44)).toBe(true)
    const checkboxHitArea = await form.getByRole('checkbox').evaluate((control) => {
      const target = getComputedStyle(control, '::before')
      return { height: Number.parseFloat(target.height), width: Number.parseFloat(target.width) }
    })
    expect(checkboxHitArea).toEqual({ height: 44, width: 44 })
    await form.getByRole('button', { name: 'Send request' }).click()
    await expect(form.getByLabel('Name')).toBeFocused()
    const invalidName = form.getByLabel('Name')
    await expect(invalidName).toHaveAttribute('aria-invalid', 'true')
    const errorID = await invalidName.getAttribute('aria-describedby')
    expect(errorID).toBeTruthy()
    await expect(form.locator(`#${errorID}`)).toHaveAttribute('role', 'alert')
    await expect(form.locator(`#${errorID}`)).toHaveText('This field is required')
    await page.route('**/api/form-submissions', async (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'ok' }),
      }),
    )
    await invalidName.fill('E2E Visitor')
    await form.getByLabel('Email').fill('visitor@example.invalid')
    await form.getByRole('checkbox', { name: 'I agree to the terms' }).check()
    await form.getByRole('combobox', { name: 'Region' }).click()
    await page.getByRole('option', { name: 'Asia' }).click()
    await form.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByRole('status')).toContainText('Thank you for your request.')
    await save(page, testInfo, 'missing-media-form')
  })

  test('Banner quartet, archive, pagination and search render across the four viewport widths', async ({
    page,
  }, testInfo) => {
    await page.route(`${mediaOrigin}/**`, (route) =>
      route.fulfill({
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
        contentType: 'image/svg+xml',
      }),
    )
    const browserErrors: string[] = []
    const failedRequests: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('requestfailed', (request) =>
      failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`),
    )
    for (const width of [390, 768, 1024, 1440]) {
      const height = width === 390 ? 844 : width === 768 ? 1024 : width === 1024 ? 768 : 900
      await page.setViewportSize({ width, height })
      await page.goto(`${baseURL}/posts/${postHeroSlug}`)
      for (const copy of Object.values(bannerCopy)) await expect(page.getByText(copy)).toBeVisible()
      const banners = page.locator('[class*="embeddedBanner"]')
      await expect(banners).toHaveCount(4)
      const expectedBannerLabels = ['Information', 'Success', 'Warning', 'Error']
      for (const [index, banner] of (await banners.all()).entries()) {
        const colors = await banner.evaluate((element) => {
          const surface = element.querySelector('[class*="surface"]')!
          return {
            background: getComputedStyle(surface).backgroundColor,
            foreground: getComputedStyle(surface).color,
            label: surface.querySelector('span')?.textContent?.trim() ?? null,
            layout: {
              clientWidth: surface.clientWidth,
              scrollWidth: surface.scrollWidth,
              documentWidth: document.documentElement.scrollWidth,
              viewportWidth: innerWidth,
            },
            accessibleStatus: {
              ariaLabel: element.getAttribute('aria-label'),
              ariaLive: element.getAttribute('aria-live'),
              role: surface.getAttribute('role'),
            },
          }
        })
        const ratio = contrastRatio(colors.foreground, colors.background)
        console.log(
          `Banner ${width}px rendered status semantics, long-content layout, and contrast: ${JSON.stringify({ ...colors, ratio })}`,
        )
        expect(colors.background).not.toBe('rgba(0, 0, 0, 0)')
        expect(colors.foreground).not.toBe('rgba(0, 0, 0, 0)')
        expect(colors.label).toBe(expectedBannerLabels[index])
        expect(colors.accessibleStatus.role).toBe('note')
        expect(colors.accessibleStatus.ariaLive).toBeNull()
        expect(colors.layout.scrollWidth).toBeLessThanOrEqual(colors.layout.clientWidth)
        expect(colors.layout.documentWidth).toBeLessThanOrEqual(colors.layout.viewportWidth)
        expect(ratio).toBeGreaterThanOrEqual(4.5)
      }
      if (width === 390 || width === 1440) await save(page, testInfo, 'banners')

      await page.goto(`${baseURL}/posts`)
      await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible()
      const archiveCards = await page.locator('[data-slot="content-card"]').count()
      const nextPageControl = page.getByRole('button', { name: 'Go to next page' })
      const hasNextPageControl = (await nextPageControl.count()) > 0
      console.log(
        `Static posts archive at ${width}px: ${JSON.stringify({ archiveCards, hasNextPageControl })}`,
      )
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      if (width === 390 || width === 1440) await save(page, testInfo, 'archive-page-1')

      const pageTwoResponse = await page.goto(`${baseURL}/posts/page/2`)
      const pageTwoHeading = await page.getByRole('heading', { name: 'Posts' }).count()
      const previousPageControl = await page
        .getByRole('button', { name: 'Go to previous page' })
        .count()
      const pageTwoCards = await page.locator('[data-slot="content-card"]').count()
      console.log(
        `Static posts archive page 2 at ${width}px: ${JSON.stringify({ cards: pageTwoCards, heading: pageTwoHeading, previousPageControl, status: pageTwoResponse?.status() })}`,
      )
      expect(pageTwoResponse?.status()).toBe(200)
      expect(pageTwoHeading).toBe(1)
      expect(previousPageControl).toBe(1)
      expect(pageTwoCards).toBeGreaterThan(0)

      const searchResponse = await page.goto(
        `${baseURL}/search?q=${encodeURIComponent(bannerQuery)}`,
      )
      await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible()
      const searchResults = await page.getByRole('link', { name: /E2E Banner matrix/ }).count()
      const searchContent = (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim()
      const preservedQuery = new URL(page.url()).searchParams.get('q')
      console.log(
        `Run-scoped search fixture at ${width}px: ${JSON.stringify({ status: searchResponse?.status(), url: page.url(), preservedQuery, searchResults, searchContent, browserErrors: browserErrors.slice(-4), failedRequests: failedRequests.slice(-4) })}`,
      )
      expect(searchResponse?.status()).toBe(200)
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(bannerQuery)
      await expect
        .poll(() => page.getByRole('link', { name: /E2E Banner matrix/ }).count())
        .toBeGreaterThan(0)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      if (width === 390 || width === 1440) await save(page, testInfo, 'search-results')
    }
  })

  test('coarse pointer, reduced motion, forced colors, and nested default/inverse are usable', async ({
    page,
    browser,
  }) => {
    await preparePage(page, 390, 844)
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
    await expect
      .poll(() => page.evaluate(() => matchMedia('(forced-colors: active)').matches))
      .toBe(true)
    await expect
      .poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
      .toBe(true)
    await expect(page.locator('[data-hero="medium-impact"]')).not.toHaveAttribute(
      'data-website-theme',
      'inverse',
    )
    await expect(page.locator('main [data-website-theme="inverse"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
    const navButton = page.getByRole('button', { name: 'Open navigation' })
    const navBox = await navButton.boundingBox()
    expect(navBox).not.toBeNull()
    expect(navBox!.width).toBeGreaterThanOrEqual(44)
    expect(navBox!.height).toBeGreaterThanOrEqual(44)
    await navButton.focus()
    await expect(navButton).toHaveCSS('outline-style', 'solid')
    await navButton.click()
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect(dialog).toBeVisible()
    await expect
      .poll(() =>
        dialog
          .getByRole('button', { name: 'Close navigation' })
          .locator('span')
          .first()
          .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration)),
      )
      .toBeLessThan(0.001)
    await page.goto(`${baseURL}/posts/${postHeroSlug}`)
    await expect(page.locator('[data-hero="post"]')).toHaveAttribute(
      'data-website-theme',
      'inverse',
    )
    await expect(page.locator('body')).not.toHaveAttribute('data-website-theme', 'inverse')

    const touchContext = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    })
    try {
      const touchPage = await touchContext.newPage()
      await touchPage.goto(`${baseURL}${pagePath}`)
      await expect
        .poll(() => touchPage.evaluate(() => matchMedia('(pointer: coarse)').matches))
        .toBe(true)
      const touchControl = touchPage.getByRole('button', { name: 'Open navigation' })
      await expect(touchControl).toBeVisible()
      await touchControl.tap()
      await expect(touchPage.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
    } finally {
      await touchContext.close()
    }
  })
})
