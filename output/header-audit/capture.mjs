// Captures the live Header from the running dev server (http://localhost:3001)
// and measures the mega menu's real geometry. Read-only: navigates and hovers,
// never submits anything. Output goes to output/header-audit/ (untracked).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// pnpm's node_modules is not flat, so resolve the store path directly.
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)

const here = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(here, 'shots'), { recursive: true })

const BASE = 'http://localhost:3001'
const browser = await chromium.launch()
const report = []

/* ---------------------------------------------------------------- desktop */

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 })

const triggers = await page.evaluate(() =>
  [...document.querySelectorAll('header button')]
    .filter((b) => b.getAttribute('aria-expanded') !== null)
    .map((b, i) => ({ i, label: b.textContent.trim(), visible: b.offsetParent !== null }))
    .filter((b) => b.visible),
)
report.push({ section: 'desktop triggers', triggers })

await page.screenshot({ path: join(here, 'shots', 'desktop-top.png') })

const openTrigger = async (i) => {
  const btn = page.locator('header button[aria-expanded]').nth(i)
  await btn.click()
  await page.waitForTimeout(450)
}

for (const t of triggers) {
  await openTrigger(t.i)
  const slug = t.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `menu-${t.i}`
  await page.screenshot({ path: join(here, 'shots', `desktop-menu-${slug}.png`) })

  const geom = await page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const cs = (el, props) =>
      el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]])) : null
    const panel = document.querySelector('[class*="megaMenuInner"]')
    if (!panel) return { panel: null }
    const cardOf = (sel) => {
      const el = panel.querySelector(sel)
      if (!el) return null
      const box = r(el)
      return {
        selector: sel,
        w: Math.round(box.width),
        h: Math.round(box.height),
        ...cs(el, ['padding', 'borderRadius', 'backgroundColor', 'border']),
      }
    }
    const textOf = (sel) => {
      const el = panel.querySelector(sel)
      if (!el) return null
      return { selector: sel, text: el.textContent.trim().slice(0, 30), ...cs(el, ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'textTransform']) }
    }
    return {
      panel: { w: Math.round(r(panel).width), h: Math.round(r(panel).height), padding: getComputedStyle(panel).padding },
      grid: cs(panel.querySelector('[class*="navigationBlocks"]'), ['gap', 'gridTemplateColumns']),
      cards: [
        cardOf('[class*="navigationCardProduct"]'),
        cardOf('[class*="navigationCardRich"]'),
        cardOf('[class*="navigationCardVisual"]'),
      ].filter(Boolean),
      text: [
        textOf('[class*="blockHeading"]'),
        textOf('[class*="categoryHeading"]'),
        textOf('[class*="navigationCardTitle"]'),
        textOf('[class*="navigationCardDescription"]'),
        textOf('[class*="linkList"] a'),
        textOf('[class*="blockCTA"]'),
      ].filter(Boolean),
      counts: {
        productCards: panel.querySelectorAll('[class*="navigationCardProduct"]').length,
        richCards: panel.querySelectorAll('[class*="navigationCardRich"]').length,
        visualCards: panel.querySelectorAll('[class*="navigationCardVisual"]').length,
        linkGroups: panel.querySelectorAll('[class*="linkGroup"]').length,
        categoryTabs: panel.querySelectorAll('[class*="categoryTab"]').length,
      },
    }
  })
  report.push({ section: `menu: ${t.label}`, geom })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
}

/* ---- header chrome measurements ---- */
const chrome = await page.evaluate(() => {
  const r = (s) => {
    const el = document.querySelector(s)
    return el ? Math.round(el.getBoundingClientRect().height) : null
  }
  const g = (s, props) => {
    const el = document.querySelector(s)
    return el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]])) : null
  }
  return {
    headerHeight: getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim(),
    surfaceH: r('header [class*="surface"]'),
    topLevel: g('[class*="topLevelLink"]', ['fontSize', 'fontWeight', 'letterSpacing', 'color']),
    cta: g('[class*="menuCta"]', ['fontSize', 'fontWeight', 'padding', 'border', 'borderRadius', 'background']),
    trackGap: g('[class*="primaryNavigationTrack"]', ['gap']),
  }
})
report.push({ section: 'header chrome @1440', chrome })

/* ----------------------------------------------------------------- mobile */

const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await m.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 })
await m.screenshot({ path: join(here, 'shots', 'mobile-top.png') })
const menuBtn = m.locator('header button[class*="mobileMenuButton"]').first()
await menuBtn.click()
await m.waitForTimeout(400)
await m.screenshot({ path: join(here, 'shots', 'mobile-menu.png'), fullPage: false })
const firstAcc = m.locator('[class*="mobileAccordionTrigger"]').first()
if (await firstAcc.count()) {
  await firstAcc.click()
  await m.waitForTimeout(400)
  await m.screenshot({ path: join(here, 'shots', 'mobile-menu-expanded.png') })
}

writeFileSync(join(here, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
