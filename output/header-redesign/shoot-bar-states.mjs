// Bar states for the CTA check: dark-hero top, scrolled, and CTA hover on both. `node shoot-bar-states.mjs <dir>`
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const outDir = join(dirname(fileURLToPath(import.meta.url)), process.argv[2] ?? 'live-after-cta')
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(process.env.SITE ?? 'http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(800)
const clip = { x: 0, y: 0, width: 1440, height: 96 }
const cta = page.locator('header a[class*="menuCta"]:visible').first()
await page.screenshot({ path: join(outDir, 'bar-top.png'), clip })
await cta.hover(); await page.waitForTimeout(300)
await page.screenshot({ path: join(outDir, 'bar-top-hover.png'), clip })
await page.mouse.move(700, 600)
await page.mouse.wheel(0, 900); await page.waitForTimeout(900)
await page.screenshot({ path: join(outDir, 'bar-scrolled.png'), clip })
await cta.hover(); await page.waitForTimeout(300)
await page.screenshot({ path: join(outDir, 'bar-scrolled-hover.png'), clip })
await browser.close()
