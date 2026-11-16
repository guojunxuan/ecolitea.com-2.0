import { expect, test } from '@playwright/test'
import { getE2EBaseURL } from '../helpers/e2eBaseURL'

const baseURL = getE2EBaseURL()

for (const width of [1440, 390]) {
  test(`language switching and preferences at ${width}px`, async ({ page, context }) => {
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
    await page.screenshot({ path: `/tmp/phase4-language-${width}.png` })
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
    .evaluate((element) => (element as HTMLButtonElement).click())
  await expect(page.getByRole('dialog', { name: 'Region & language' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible()
})

test('live locale changes invalidate URLs, panel and sitemap without deployment; Admin tabs', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: '' }),
  )
  const login = await request.post(`${baseURL}/api/users/login`, {
    data: { email: 'phase4-admin@example.invalid', password: 'phase4-test-only' },
  })
  expect(login.ok()).toBe(true)
  const originalResponse = await request.get(`${baseURL}/api/globals/site-settings?depth=0`)
  const original = await originalResponse.json()
  const save = async (data: unknown) => {
    const response = await request.post(`${baseURL}/api/globals/site-settings`, { data })
    expect(response.ok(), await response.text()).toBe(true)
  }
  try {
    await save({
      languages: [
        { code: 'de', status: 'off' },
        { code: 'fr', status: 'translating' },
      ],
      regions: [{ id: 'GLOBAL', label: 'Global', locale: 'en' }],
    })
    expect((await page.goto(`${baseURL}/de/phase3-ready`))?.status()).toBe(404)
    expect((await page.goto(`${baseURL}/fr/phase3-ready`))?.status()).toBe(404)
    expect((await page.goto(`${baseURL}/zh-tw/phase3-ready`))?.status()).toBe(404)
    expect((await page.goto(`${baseURL}/xx/phase3-ready`))?.status()).toBe(404)
    expect(await (await request.get(`${baseURL}/pages-sitemap.xml`)).text()).not.toContain(
      '/de/phase3-ready',
    )
    await page.goto(`${baseURL}/phase3-ready`)
    await page.getByRole('button', { name: 'Region & language' }).filter({ visible: true }).click()
    const panel = page.getByRole('dialog', { name: 'Region & language' })
    await expect(panel.getByRole('button', { name: /Global/ })).toBeVisible()
    await expect(panel.getByRole('button', { name: /Deutschland/ })).toHaveCount(0)
    await save({
      languages: original.languages,
      regions: original.regions,
      cookieConsent: { bannerTitle: 'Phase4 editable cookie title' },
    })
    await expect
      .poll(async () => (await request.get(`${baseURL}/pages-sitemap.xml`)).text())
      .toContain('/de/phase3-ready')
    await page.goto(`${baseURL}/de/phase3-ready`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(page.locator('link[hreflang="de"]')).toHaveAttribute(
      'href',
      `${baseURL}/de/phase3-ready`,
    )
    await expect(page.getByRole('heading', { name: 'Phase4 editable cookie title' })).toBeVisible()
    await save({
      languages: [{ code: 'de', status: 'off' }],
      regions: [{ id: 'GLOBAL', label: 'Global', locale: 'en' }],
    })
    expect((await page.goto(`${baseURL}/de/phase3-ready`))?.status()).toBe(404)
    expect(await (await request.get(`${baseURL}/pages-sitemap.xml`)).text()).not.toContain(
      '/de/phase3-ready',
    )
    // Empty configuration preserves the English site and still exposes Global · EN.
    await save({ languages: [], regions: [], cookieConsent: {} })
    await page.goto(`${baseURL}/phase3-ready`)
    await expect(page.locator('link[hreflang]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Region & language' }).filter({ visible: true }).click()
    await expect(
      page.getByRole('dialog', { name: 'Region & language' }).getByRole('button'),
    ).toHaveCount(2)
    await page.keyboard.press('Escape')
    await save({ languages: original.languages, regions: original.regions })
    await page.goto(`${baseURL}/admin/login`)
    await page.getByLabel('Email').fill('phase4-admin@example.invalid')
    await page.locator('input[name="password"]').fill('phase4-test-only')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/?$/)
    await page.goto(`${baseURL}/admin/globals/site-settings`)
    await page.getByRole('tab', { name: 'Language', exact: true }).click()
    const usage = page.getByRole('progressbar', { name: 'Monthly translation usage' })
    expect((await usage.boundingBox())!.height).toBeGreaterThan(0)
    await expect(usage).toHaveAttribute('aria-valuenow', '0')
    const colors = await usage.evaluate((track) => ({
      track: getComputedStyle(track).backgroundColor,
      fill: getComputedStyle(track.firstElementChild!).backgroundColor,
      width: track.firstElementChild!.getBoundingClientRect().width,
    }))
    expect(colors.track).not.toBe(colors.fill)
    expect(colors.width).toBe(0)
    await page.getByRole('table').getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: 'live', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect
      .poll(
        async () =>
          (
            await (await request.get(`${baseURL}/api/globals/site-settings?depth=0`)).json()
          ).languages.find((row: { code: string }) => row.code === 'fr').status,
      )
      .toBe('live')
    await page.reload()
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.getByRole('tab', { name: 'Language', exact: true }).click()
      await expect(page.getByRole('table').getByText('Deutsch')).toBeVisible()
      await expect(page.getByRole('table')).toHaveCSS('border-collapse', 'separate')
      await expect(page.getByRole('table').getByRole('combobox')).toHaveCount(2)
      await page.screenshot({
        path: `/tmp/phase4-site-settings-language-${width}.png`,
        fullPage: true,
      })
      await page.getByRole('tab', { name: 'Brand', exact: true }).click()
      await page.screenshot({ path: `/tmp/phase4-site-settings-tabs-${width}.png`, fullPage: true })
    }
  } finally {
    await save({
      languages: original.languages,
      regions: original.regions,
      cookieConsent: original.cookieConsent ?? {},
    })
  }
})
