// Mock-only comparison: mega menu glass opacity and desktop link row height.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const { chromium } = await import(new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href)
const outDir = join(import.meta.dirname, 'glass-rows'); mkdirSync(outDir, { recursive: true })
const PANEL = '[class$="__megaMenu"]'
const BAR = 'header > div[data-menu-open="true"]'
const glass = {
  g0: '',
  g0fix: `${PANEL} { backdrop-filter: blur(28px) saturate(120%) !important; }
          header > div[data-scrolled="true"]:not([data-menu-open="true"]) { backdrop-filter: blur(18px) saturate(115%) !important; }`,
  g1: `${PANEL}, ${BAR} { background: rgb(255 255 255 / 94%) !important; }
       ${PANEL} { backdrop-filter: blur(24px) saturate(120%) !important; }`,
  g2: `${PANEL}, ${BAR} { background: #fff !important; backdrop-filter: none !important; }`,
}
const rows = { r32: '', r36: `${PANEL} [class*="linkList"] a { min-height: 2.25rem !important; }`, r40: `${PANEL} [class*="linkList"] a { min-height: 2.5rem !important; }` }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
const btn = (name) => page.locator('header nav button[aria-expanded]:visible', { hasText: name })
async function shot(css, menu, file, y = 0) {
  await page.keyboard.press('Escape'); await page.mouse.move(5, 880); await page.waitForTimeout(400)
  await page.evaluate(([css, y]) => {
    document.getElementById('mock')?.remove()
    const s = document.createElement('style'); s.id = 'mock'; s.textContent = css; document.head.append(s)
    window.scrollTo(0, y)
  }, [css, y]); await page.waitForTimeout(600)
  await btn(menu).click(); await page.waitForTimeout(900)
  await page.evaluate(() => document.querySelectorAll('img').forEach((im) => (im.loading = 'eager')))
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(500)
  const box = await page.locator(PANEL).boundingBox()
  await page.screenshot({ path: join(outDir, file), clip: { x: 0, y: 0, width: 1440, height: Math.round(box.y + box.height + 60) } })
  const sample = await page.evaluate((sel) => {
    const el = document.querySelector(sel); return el && getComputedStyle(el).backgroundColor
  }, PANEL)
  return { h: Math.round(box.height), bg: sample }
}
const out = {}
for (const [k, css] of Object.entries(glass)) {
  if (process.env.ONLY && k !== process.env.ONLY) continue
  out[`${k}-products-top`] = await shot(css, 'Products', `${k}-products-top.png`)
  out[`${k}-products-scrolled`] = await shot(css, 'Products', `${k}-products-scrolled.png`, 2400)
}
if (!process.env.GLASS_ONLY) for (const [k, css] of Object.entries(rows)) for (const m of ['Professional', 'Support'])
  out[`${k}-${m}`] = await shot(css, m, `${k}-${m.toLowerCase()}.png`, 2400)
console.log(JSON.stringify(out, null, 1))
await browser.close()
