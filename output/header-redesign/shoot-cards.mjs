// Products panel with candidate card parameters injected (mock only): `node shoot-cards.mjs`.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'cards')
mkdirSync(outDir, { recursive: true })
const P = '[class*="navigationCardProduct"]'
const variants = {
  current: '',
  a: `
    ${P} [class*="navigationCardImage"] { aspect-ratio: 3 / 2 !important; }
    ${P} img { max-height: 86% !important; max-width: 86% !important; }
    ${P} [class*="navigationCardBody"] { margin-top: .25rem !important; }
    [class*="productCardGrid"] { row-gap: 1rem !important; }`,
  b: `
    ${P} { padding: .5rem .5rem .75rem !important; }
    ${P} [class*="navigationCardImage"] { aspect-ratio: 2 / 1 !important; }
    ${P} img { max-height: 90% !important; max-width: 90% !important; }
    ${P} [class*="navigationCardBody"] { height: 1.35em !important; margin-top: .25rem !important; }
    [class*="productCardGrid"] { row-gap: 1rem !important; }
    [class*="megaMenuInner"] { padding-block: 1.5rem 2rem !important; }`,
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(process.env.SITE ?? 'http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
const res = {}
for (const [name, css] of Object.entries(variants)) {
  await page.evaluate((css) => {
    document.getElementById('mock')?.remove()
    const s = document.createElement('style'); s.id = 'mock'; s.textContent = css; document.head.append(s)
  }, css)
  await page.keyboard.press('Escape'); await page.mouse.move(5, 880); await page.waitForTimeout(400)
  await page.locator('button[aria-expanded]').first().click()
  await page.waitForTimeout(900)
  await page.evaluate(() => document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')))
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(600)
  res[name] = await page.evaluate(() => {
    const menu = document.querySelector('[class*="megaMenuInner"]').parentElement.getBoundingClientRect()
    const card = document.querySelector('[class*="navigationCardProduct"]').getBoundingClientRect()
    return { menu: Math.round(menu.height), card: `${Math.round(card.width)}x${Math.round(card.height)}` }
  })
  await page.screenshot({ path: join(outDir, `${name}.png`) })
}
console.log(JSON.stringify(res))
await browser.close()
