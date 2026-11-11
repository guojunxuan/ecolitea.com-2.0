// Products panel over dark hero (top) and light content (scrolled), surface candidates (mock only).
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'surfaces2'); mkdirSync(outDir, { recursive: true })
const CTAS = '[class*="blockCTA"], [class*="categoryPrimaryCTA"], [class*="categoryActiveCTA"]'
const CARDS = '[class*="navigationCardProduct"], [class*="navigationCardRich"]'
const variants = {
  current: '',
  tokens: `${CARDS} { background: var(--website-color-muted-surface) !important; }
    ${CTAS} { border-color: var(--website-color-border) !important; }
    [class*="categoryTabActive"] { background: var(--website-color-interactive-surface) !important; }`,
  filled: `${CARDS} { background: var(--website-color-surface) !important; }
    ${CTAS} { border-color: var(--website-color-border) !important; background: var(--website-color-surface) !important; }
    [class*="categoryTabActive"] { background: var(--website-color-surface) !important; }`,
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(process.env.SITE ?? 'http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
const trigger = page.locator('header nav button[aria-expanded]:visible').first()
for (const [name, css] of Object.entries(variants)) {
  await page.evaluate((css) => {
    document.getElementById('mock')?.remove()
    const s = document.createElement('style'); s.id = 'mock'; s.textContent = css; document.head.append(s)
  }, css)
  for (const [state, y] of [['top', 0], ['scrolled', 2400]]) {
    await page.keyboard.press('Escape'); await page.mouse.move(5, 880); await page.waitForTimeout(400)
    await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(600)
    await trigger.click(); await page.waitForTimeout(900)
    await page.evaluate(() => document.querySelectorAll('img').forEach((im) => (im.loading = 'eager')))
    await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(500)
    await page.screenshot({ path: join(outDir, `${name}-${state}.png`), clip: { x: 90, y: 72, width: 1260, height: 260 } })
  }
}
await browser.close()
