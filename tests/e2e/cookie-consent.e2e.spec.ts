import { expect, test } from '@playwright/test'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const baseURL = getE2EBaseURL()
let gtmRequests: string[]

test.beforeEach(async ({ page }) => {
  gtmRequests = []
  // Fulfill locally: the browser must never contact the real Google service.
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    gtmRequests.push(route.request().url())
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  })
})

test('first visit stays denied without a Google request; rejection survives reload', async ({
  page,
}) => {
  await page.goto(`${baseURL}/blogs`)
  const banner = page.getByRole('region', { name: 'Cookie consent' })
  await expect(banner).toBeVisible()
  expect(gtmRequests).toHaveLength(0)
  await expect(page.locator('script[data-ecolitea-gtm]')).toHaveCount(0)
  await banner.getByRole('button', { name: 'Reject optional' }).click()
  await expect(banner).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Legal' })).toBeVisible()
  await expect(banner).toHaveCount(0)
  expect(gtmRequests).toHaveLength(0)
})

test('acceptance loads GTM once across client navigation', async ({ page }) => {
  await page.goto(`${baseURL}/blogs`)
  await page.getByRole('button', { name: 'Accept all' }).click()
  await expect.poll(() => gtmRequests.length).toBe(1)
  expect(gtmRequests[0]).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST000')
  await page
    .getByRole('navigation', { name: 'Blog categories' })
    .getByRole('link', { name: 'Brewing', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Brewing Blogs' })).toBeVisible()
  await expect(page.locator('script[data-ecolitea-gtm]')).toHaveCount(1)
  expect(gtmRequests).toHaveLength(1)
})

test('closing the banner leaves the decision unset and it returns on reload', async ({
  page,
  context,
}) => {
  await page.goto(`${baseURL}/blogs`)
  await page
    .getByRole('region', { name: 'Cookie consent' })
    .getByRole('button', { name: 'Close' })
    .click()
  expect((await context.cookies()).some(({ name }) => name === 'ec_consent')).toBe(false)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeVisible()
  expect(gtmRequests).toHaveLength(0)
})

test('footer settings grant analytics, revoke it, and clear GA cookies', async ({
  page,
  context,
}) => {
  await page.goto(`${baseURL}/blogs`)
  await page.getByRole('button', { name: 'Reject optional' }).click()
  const trigger = page
    .getByRole('navigation', { name: 'Legal' })
    .getByRole('button', { name: 'Cookie settings' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Cookie settings' })
  await dialog.getByRole('switch', { name: 'Analytics' }).click()
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await expect.poll(() => gtmRequests.length).toBe(1)
  await context.addCookies([
    { name: '_ga', value: 'test', url: baseURL },
    { name: '_ga_TEST', value: 'test', url: baseURL },
    { name: '_gcl_au', value: 'test', url: baseURL },
  ])
  await trigger.click()
  await expect(dialog.getByRole('switch', { name: 'Analytics' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await dialog.getByRole('switch', { name: 'Analytics' }).click()
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await expect(trigger).toBeFocused()
  await expect
    .poll(async () => (await context.cookies()).filter(({ name }) => /^_ga|^_gcl_/.test(name)))
    .toEqual([])
  expect(gtmRequests).toHaveLength(1)
})

for (const width of [1440, 390]) {
  test(`banner and settings geometry and keyboard behavior at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`${baseURL}/blogs`)
    const banner = page.getByRole('region', { name: 'Cookie consent' })
    await expect(banner).toBeVisible()
    const box = await banner.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    expect(
      await page.evaluate(() => parseFloat(document.body.style.paddingBottom)),
    ).toBeGreaterThanOrEqual(box!.height)
    if (width === 390) {
      const more = banner.getByRole('button', { name: 'Read more' })
      await expect(more).toHaveAttribute('aria-expanded', 'false')
      const descriptionId = await more.getAttribute('aria-controls')
      await more.click()
      await expect(banner.getByRole('button', { name: 'Read less' })).toHaveAttribute(
        'aria-expanded',
        'true',
      )
      expect(
        await page
          .locator(`[id="${descriptionId}"]`)
          .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
      ).toBe(true)
      await page.screenshot({ path: '/tmp/phase4-cookie-banner-expanded-390.png' })
      await banner.getByRole('button', { name: 'Read less' }).click()
      await expect(more).toHaveAttribute('aria-expanded', 'false')
    }
    await page.screenshot({ path: `/tmp/phase4-cookie-banner-${width}.png` })
    const trigger = banner.getByRole('button', { name: 'Cookie settings' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Cookie settings' })
    await expect(dialog).toBeVisible()
    // Measure the final frame, not the translated/scaled entrance animation.
    await dialog.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished))
    })
    const dialogBox = await dialog.boundingBox()
    expect(Math.abs(dialogBox!.x + dialogBox!.width / 2 - width / 2)).toBeLessThan(1)
    if (width === 1440) {
      expect(Math.abs(dialogBox!.y + dialogBox!.height / 2 - 422)).toBeLessThan(1)
    } else {
      // The current mobile design is a content-height bottom sheet.
      expect(dialogBox!.width).toBe(width)
      expect(Math.abs(dialogBox!.y + dialogBox!.height - 844)).toBeLessThan(1)
      expect(dialogBox!.height).toBeLessThanOrEqual(844 * 0.85)
    }
    const save = dialog.getByRole('button', { name: 'Save settings' })
    const saveBox = await save.boundingBox()
    expect(saveBox!.y).toBeGreaterThanOrEqual(0)
    expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(844)
    if (width === 390) expect(saveBox!.width).toBeGreaterThan(340)
    await save.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Reject optional' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(save).toBeFocused()
    await page.screenshot({ path: `/tmp/phase4-cookie-settings-${width}.png` })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(gtmRequests).toHaveLength(0)
  })
}
