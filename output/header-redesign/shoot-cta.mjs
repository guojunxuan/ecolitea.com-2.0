// Header CTA + border/surface token candidates (mock injection only): `node shoot-cta.mjs`.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'cta')
mkdirSync(outDir, { recursive: true })
const CTA = '[class*="menuCta"]:not([class*="mobileMenuCta"])'
const DARK = `[class*="surface"]:not([data-scrolled="true"]):not([data-menu-open="true"])`
const variants = {
  current: '',
  outline8: `${CTA} { border-radius: 8px !important; font-weight: 500 !important; }`,
  solid8: `
    ${CTA} { border-radius: 8px !important; font-weight: 500 !important; border-color: transparent !important;
      background: var(--website-color-action) !important; color: var(--website-color-action-foreground) !important; }
    body:has(main [data-header-theme='dark']) ${DARK} ${CTA}, [data-theme='dark']${DARK} ${CTA} {
      background: var(--website-color-brand-white) !important; color: var(--website-color-brand-black) !important; }`,
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(process.env.SITE ?? 'http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(800)
const info = await page.evaluate(() => {
  const s = document.querySelector('header [class*="surface"]') ?? document.querySelector('[class*="surface"]')
  return { color: getComputedStyle(s).color, dark: !!document.querySelector('main [data-header-theme="dark"]') }
})
console.log(JSON.stringify(info))
for (const [name, css] of Object.entries(variants)) {
  await page.evaluate((css) => {
    document.getElementById('mock')?.remove()
    const s = document.createElement('style'); s.id = 'mock'; s.textContent = css; document.head.append(s)
  }, css)
  for (const state of ['top', 'scrolled']) {
    await page.evaluate((y) => window.scrollTo(0, y), state === 'top' ? 0 : 900)
    await page.waitForTimeout(700)
    await page.screenshot({ path: join(outDir, `${name}-${state}.png`), clip: { x: 900, y: 0, width: 540, height: 72 } })
  }
}
await browser.close()
