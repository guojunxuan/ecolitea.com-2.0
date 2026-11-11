// Second pass: Products mega menu, grouped per category panel (the first pass
// flattened all four tabs together). Read-only.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)

const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(4000)
await page.locator('header button[aria-expanded]').first().click()
await page.waitForTimeout(1200)

const tabCount = await page.locator('button[class*="categoryTab"]').count()
for (let t = 0; t < tabCount; t++) {
  await page.locator('button[class*="categoryTab"]').nth(t).click()
  await page.waitForTimeout(900)
}
await page.evaluate(() => {
  for (const img of document.querySelectorAll('[class*="megaMenuInner"] img')) img.loading = 'eager'
})
await page.waitForTimeout(4000)

const panels = await page.evaluate(() => {
  const panel = document.querySelector('[class*="megaMenuInner"]')
  const tabs = [...panel.querySelectorAll('button[class*="categoryTab"]')].map((t) => t.textContent.trim())
  const groups = [...panel.querySelectorAll('[class*="categoryPanel"]')].filter(
    (p) => !p.className.includes('PanelStack'),
  )
  return groups.map((g, i) => ({
    tab: tabs[i] ?? `tab-${i}`,
    heading: g.querySelector('[class*="categoryHeading"]')?.textContent.trim() ?? '',
    cta: g.querySelector('[class*="categoryActiveCTA"], [class*="blockCTA"]')?.textContent.trim() ?? '',
    cards: [...g.querySelectorAll('[class*="navigationCardProduct"]')].map((el) => ({
      title: el.querySelector('[class*="navigationCardTitle"]')?.textContent.trim() ?? '',
      img: el.querySelector('img')?.currentSrc || el.querySelector('img')?.src || '',
    })),
  }))
})

writeFileSync(join(here, 'products.json'), JSON.stringify(panels, null, 2))
console.log(panels.map((p) => `${p.tab} / ${p.heading} / cta:${p.cta} / ${p.cards.length} cards`).join('\n'))
await browser.close()
