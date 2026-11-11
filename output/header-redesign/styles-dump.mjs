// Dump computed styles of every header element in each menu state: `node styles-dump.mjs <name>` → styles-<name>.json
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const base = process.env.SITE ?? 'http://localhost:3001/'
const PROPS = ['font-size', 'line-height', 'font-weight', 'letter-spacing', 'text-transform', 'font-family', 'color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'row-gap', 'column-gap', 'width', 'height', 'min-height', 'min-width', 'max-height', 'aspect-ratio',
  'background-color', 'border-top-color', 'border-top-width', 'border-top-left-radius', 'transition-duration', 'animation-duration', 'box-shadow']
const dumpFn = (props) => {
  const out = {}
  const root = document.querySelector('header')
  if (!root) return out
  const all = [root, ...root.querySelectorAll('*')]
  all.forEach((el, i) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none') return
    const key = `${i}:${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/)[0]?.replace(/__\w+$/, '') ?? ''}`
    out[key] = Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]))
  })
  return out
}
const result = {}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto(base, { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(800)
result['desktop-bar'] = await page.evaluate(`(${dumpFn})(${JSON.stringify(PROPS)})`)
const triggers = page.locator('header nav button[aria-expanded]:visible')
const n = await triggers.count()
for (let i = 0; i < n; i++) {
  await page.keyboard.press('Escape'); await page.mouse.move(5, 990); await page.waitForTimeout(500)
  await triggers.nth(i).click(); await page.waitForTimeout(1000)
  result[`desktop-panel-${i}`] = await page.evaluate(`(${dumpFn})(${JSON.stringify(PROPS)})`)
}
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await m.goto(base, { waitUntil: 'load', timeout: 90000 })
await m.locator('button[aria-label="Open navigation"]').first().click(); await m.waitForTimeout(700)
result['mobile-open'] = await m.evaluate(`(${dumpFn})(${JSON.stringify(PROPS)})`)
const acc = m.locator('[class*="mobileAccordionTrigger"]').first()
await acc.click(); await m.waitForTimeout(800)
result['mobile-accordion'] = await m.evaluate(`(${dumpFn})(${JSON.stringify(PROPS)})`)
const cat = m.locator('[class*="categoryAccordionButton"]:visible').first()
if (await cat.count()) { await cat.click(); await m.waitForTimeout(800); result['mobile-category'] = await m.evaluate(`(${dumpFn})(${JSON.stringify(PROPS)})`) }
writeFileSync(join(here, `styles-${process.argv[2] ?? 'before'}.json`), JSON.stringify(result))
console.log(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, Object.keys(v).length])))
await browser.close()
