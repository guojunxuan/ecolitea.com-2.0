// Focused second pass: the Products mega menu (Category Tabs) and the mobile
// menu's expanded state, both of which the first pass missed on timing.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)

const here = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:3001'
const browser = await chromium.launch()
const out = []

const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(4000) // let React hydrate before driving the menu

const btn = page.locator('header button[aria-expanded]').first()
await btn.click()
await page.waitForTimeout(700)
await page.screenshot({ path: join(here, 'shots', 'desktop-menu-products.png') })

out.push({
  section: 'menu: Products',
  geom: await page.evaluate(() => {
    const panel = document.querySelector('[class*="megaMenuInner"]')
    if (!panel) return null
    const r = (el) => el.getBoundingClientRect()
    const cs = (el, p) => (el ? Object.fromEntries(p.map((k) => [k, getComputedStyle(el)[k]])) : null)
    const box = (sel) => {
      const el = panel.querySelector(sel)
      return el ? { sel, w: Math.round(r(el).width), h: Math.round(r(el).height), ...cs(el, ['padding', 'borderRadius', 'backgroundColor', 'gap']) } : null
    }
    const txt = (sel) => {
      const el = panel.querySelector(sel)
      return el ? { sel, text: el.textContent.trim().slice(0, 28), ...cs(el, ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) } : null
    }
    return {
      panel: { w: Math.round(r(panel).width), h: Math.round(r(panel).height), padding: getComputedStyle(panel).padding },
      tabsLayout: cs(panel.querySelector('[class*="categoryTabsDesktop"]'), ['gap', 'gridTemplateColumns']),
      productGrid: cs(panel.querySelector('[class*="productCardGrid"]'), ['gap', 'gridTemplateColumns']),
      cards: [box('[class*="navigationCardProduct"]'), box('[class*="navigationCardRich"]')].filter(Boolean),
      text: [txt('[class*="categoryHeading"]'), txt('[class*="navigationCardTitle"]'), txt('[class*="categoryTab"]')].filter(Boolean),
      counts: {
        tabs: panel.querySelectorAll('[class*="categoryTab"]:not([class*="categoryTabsDesktop"]):not([class*="categoryTabsCompact"])').length,
        productCards: panel.querySelectorAll('[class*="navigationCardProduct"]').length,
        richCards: panel.querySelectorAll('[class*="navigationCardRich"]').length,
      },
    }
  }),
})

/* ---- mobile expanded ---- */
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await m.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 })
await m.waitForTimeout(4000)
await m.locator('header button[class*="mobileMenuButton"]').first().click()
await m.waitForTimeout(500)
await m.screenshot({ path: join(here, 'shots', 'mobile-menu.png') })
const acc = m.locator('[class*="mobileAccordionTrigger"]').first()
out.push({ section: 'mobile accordion triggers', count: await acc.count() })
if (await acc.count()) {
  await acc.click()
  await m.waitForTimeout(600)
  await m.screenshot({ path: join(here, 'shots', 'mobile-menu-expanded.png') })
}

writeFileSync(join(here, 'report-products.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
await browser.close()
