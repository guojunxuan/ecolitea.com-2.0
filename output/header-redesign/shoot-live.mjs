// Shots of the real header on the local dev server: `node shoot-live.mjs before|after`.
// Desktop 1440 with each mega menu opened, plus the mobile menu at 390.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, `live-${process.argv[2] ?? 'before'}`)
mkdirSync(outDir, { recursive: true })
const base = process.env.SITE ?? 'http://localhost:3001/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto(base, { waitUntil: 'load', timeout: 90000 })
const buttons = page.locator('button[aria-expanded]')
const count = await buttons.count()
const metrics = {}
for (let i = 0; i < count; i++) {
  const label = (await buttons.nth(i).innerText()).replace(/[^\w ]/g, '').trim()
  if (!label || !(await buttons.nth(i).isVisible())) continue
  await page.mouse.move(5, 900)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await buttons.nth(i).click()
  await page.waitForTimeout(900)
  await page.evaluate(() => document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')))
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(600)
  const box = await page.evaluate(() => {
    const inner = document.querySelector('[class*="megaMenuInner"]')
    const r = inner?.parentElement?.getBoundingClientRect()
    return r ? { y: r.y, height: r.height } : null
  })
  metrics[label] = box && Math.round(box.height)
  await page.screenshot({ path: join(outDir, `${label.replace(/\W+/g, '-').toLowerCase()}.png`), clip: { x: 0, y: 0, width: 1440, height: Math.min(1000, (box?.y ?? 0) + (box?.height ?? 700) + 40) } })
}
await page.keyboard.press('Escape')
await page.mouse.move(5, 900)
await page.waitForTimeout(400)
await page.screenshot({ path: join(outDir, 'bar.png'), clip: { x: 0, y: 0, width: 1440, height: 120 } })

const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await m.goto(base, { waitUntil: 'load', timeout: 90000 })
await m.locator('button[aria-label="Open navigation"]').first().click()
await m.waitForTimeout(600)
await m.screenshot({ path: join(outDir, 'mobile.png') })
const first = m.locator('[class*="mobileAccordionTrigger"]').first()
if (await first.count()) { await first.click(); await m.waitForTimeout(800); await m.screenshot({ path: join(outDir, 'mobile-open.png') }) }
console.log(JSON.stringify(metrics))
await browser.close()
