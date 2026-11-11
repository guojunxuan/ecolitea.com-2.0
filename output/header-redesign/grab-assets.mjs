// Pulls the real menu imagery + copy off the running dev server so the redesign
// mock is judged on real content, not lorem. Read-only.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)

const here = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(here, 'img'), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(4000)

const menus = []
const triggers = await page.locator('header button[aria-expanded]').count()

for (let i = 0; i < triggers; i++) {
  const btn = page.locator('header button[aria-expanded]').nth(i)
  if (!(await btn.isVisible())) continue
  const label = (await btn.textContent()).trim()
  await btn.click()
  await page.waitForTimeout(1200)
  // nudge lazy images into loading
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('[class*="megaMenuInner"] img')) {
      img.loading = 'eager'
      if (img.dataset.src) img.src = img.dataset.src
    }
  })
  await page.waitForTimeout(2500)

  const data = await page.evaluate(() => {
    const panel = document.querySelector('[class*="megaMenuInner"]')
    if (!panel) return null
    const cls = (el) => el.className || ''
    const blocks = []
    for (const b of panel.querySelectorAll(':scope > div > *, :scope > *')) {
      if (b.matches('[class*="navigationBlocks"]')) continue
    }
    const cardData = (el) => ({
      title: el.querySelector('[class*="navigationCardTitle"]')?.textContent.trim() ?? '',
      desc: el.querySelector('[class*="navigationCardDescription"]')?.textContent.trim() ?? '',
      img: el.querySelector('img')?.currentSrc || el.querySelector('img')?.src || '',
    })
    return {
      tabs: [...panel.querySelectorAll('button[class*="categoryTab"]')].map((t) => t.textContent.trim()),
      headings: [...panel.querySelectorAll('[class*="blockHeading"], [class*="categoryHeading"]')].map((h) => ({
        text: h.textContent.trim(),
        linkGroup: !!h.closest('[class*="linkGroup"]'),
      })),
      linkGroups: [...panel.querySelectorAll('[class*="linkGroup"]')].map((g) => ({
        heading: g.querySelector('[class*="blockHeading"]')?.textContent.trim() ?? '',
        links: [...g.querySelectorAll('[class*="linkList"] a')].map((a) => a.textContent.trim()),
      })),
      visualCards: [...panel.querySelectorAll('[class*="navigationCardVisual"]')].map(cardData),
      productCards: [...panel.querySelectorAll('[class*="navigationCardProduct"]')].map(cardData),
      richCards: [...panel.querySelectorAll('[class*="navigationCardRich"]')].map(cardData),
      ctas: [...panel.querySelectorAll('[class*="blockCTA"], [class*="categoryPrimaryCTA"], [class*="navigationCTA"]')].map((c) => c.textContent.trim()),
    }
  })
  menus.push({ label, data })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

/* also collect every product card image across all four tabs of Products */
const btn0 = page.locator('header button[aria-expanded]').first()
await btn0.click()
await page.waitForTimeout(1000)
const tabCount = await page.locator('button[class*="categoryTab"]').count()
const productTabs = []
for (let t = 0; t < tabCount; t++) {
  await page.locator('button[class*="categoryTab"]').nth(t).click()
  await page.waitForTimeout(1500)
  productTabs.push(
    await page.evaluate(() => {
      const active = [...document.querySelectorAll('[class*="categoryPanel"]')].find(
        (p) => !p.className.includes('Inactive'),
      )
      if (!active) return null
      return {
        heading: active.parentElement.parentElement.querySelector('[class*="categoryHeading"]')?.textContent.trim() ?? '',
        cards: [...active.querySelectorAll('[class*="navigationCardProduct"]')].map((el) => ({
          title: el.querySelector('[class*="navigationCardTitle"]')?.textContent.trim() ?? '',
          img: el.querySelector('img')?.currentSrc || el.querySelector('img')?.src || '',
        })),
      }
    }),
  )
}

writeFileSync(join(here, 'content.json'), JSON.stringify({ menus, productTabs }, null, 2))
console.log('menus:', menus.map((m) => m.label).join(', '))
console.log('productTabs:', productTabs.map((t) => t && t.heading + ' (' + t.cards.length + ')').join(', '))
await browser.close()
