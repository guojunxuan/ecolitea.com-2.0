// Mega menu border/surface color-mix → semantic token candidates (mock only): `node shoot-surfaces.mjs`.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'surfaces')
mkdirSync(outDir, { recursive: true })
const variants = {
  current: '',
  tokens: `
    [class*="navigationCardProduct"], [class*="navigationCardRich"] { background: var(--website-color-muted-surface) !important; }
    [class*="blockCTA"], [class*="categoryPrimaryCTA"], [class*="categoryActiveCTA"] { border-color: var(--website-color-border) !important; }
    [class*="categoryTabActive"] { background: var(--website-color-interactive-surface) !important; }`,
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(process.env.SITE ?? 'http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
const triggers = page.locator('header nav button[aria-expanded]:visible')
const n = await triggers.count()
for (const [name, css] of Object.entries(variants)) {
  await page.evaluate((css) => {
    document.getElementById('mock')?.remove()
    const s = document.createElement('style'); s.id = 'mock'; s.textContent = css; document.head.append(s)
  }, css)
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Escape'); await page.mouse.move(5, 880); await page.waitForTimeout(400)
    await triggers.nth(i).click(); await page.waitForTimeout(900)
    await page.evaluate(() => document.querySelectorAll('img').forEach((im) => (im.loading = 'eager')))
    await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(500)
    const box = await page.evaluate(() => {
      const r = document.querySelector('[class*="megaMenuInner"]').parentElement.getBoundingClientRect()
      return { x: 0, y: 0, width: 1440, height: Math.min(900, Math.round(r.bottom)) }
    })
    await page.screenshot({ path: join(outDir, `${name}-${i}.png`), clip: box })
  }
}
// exact computed colors for the report
console.log(await page.evaluate(() => {
  const pick = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null }
  return JSON.stringify({ n: document.querySelectorAll('nav button[aria-expanded]').length })
}))
await browser.close()
