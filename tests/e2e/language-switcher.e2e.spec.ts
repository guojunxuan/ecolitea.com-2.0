import { expect, test } from '@playwright/test'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const baseURL = getE2EBaseURL()

for (const width of [1440, 390]) {
  test(`language switching and preferences at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('https://www.googletagmanager.com/**', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: '' }),
    )
    await page.goto(`${baseURL}/phase3-ready`)
    await page.getByRole('button', { name: 'Reject optional' }).click()
    const trigger = page.getByRole('button', { name: 'Region & language' })
    await expect(trigger).toHaveCount(1)
    const activeTrigger = trigger.filter({ visible: true })
    await activeTrigger.click()
    const panel = page.getByRole('dialog', { name: 'Region & language' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Europe' })).toBeVisible()
    await expect(panel.getByRole('button', { name: /France/ })).toHaveCount(0)
    await expect(panel.getByRole('button', { name: /Global/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const panelBox = await panel.boundingBox()
    if (width === 390) {
      expect(panelBox!.width).toBe(390)
      expect(panelBox!.height).toBe(844)
    }
    await page.screenshot({ path: testInfo.outputPath(`language-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(activeTrigger).toBeFocused()
    await activeTrigger.click()
    await panel.getByRole('button', { name: /Deutschland/ }).click()
    await expect(page).toHaveURL(`${baseURL}/de/phase3-ready`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    expect((await context.cookies()).find(({ name }) => name === 'ec_preferences')).toMatchObject({
      value: 'DE',
      sameSite: 'Lax',
      path: '/',
    })
    await page.goto(`${baseURL}/phase3-english-only`)
    await page.getByRole('button', { name: 'Region & language' }).filter({ visible: true }).click()
    await page
      .getByRole('dialog', { name: 'Region & language' })
      .getByRole('button', { name: /Deutschland/ })
      .click()
    await expect(page).toHaveURL(`${baseURL}/de?unavailable=de`)
    await expect(page.getByRole('status')).toHaveText('This page is not available in Deutsch yet.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
  })
}

test('language and Cookie settings panels remain exclusive', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  )
  await page.goto(`${baseURL}/phase3-ready`)
  await page.getByRole('button', { name: 'Reject optional' }).click()
  await page.getByRole('button', { name: 'Region & language' }).filter({ visible: true }).click()
  await page
    .getByRole('navigation', { name: 'Legal' })
    .getByRole('button', { name: 'Cookie settings' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Region & language' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible()
})
