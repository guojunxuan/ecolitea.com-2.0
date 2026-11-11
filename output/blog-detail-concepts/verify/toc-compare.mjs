import { chromium } from '@playwright/test'
const url = 'http://localhost:3001/blogs/small-details-better-everyday-products'
const browser = await chromium.launch()
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await desk.goto(url, { waitUntil: 'networkidle' })
await desk.locator('h2[id]').nth(1).evaluate((h) => h.scrollIntoView({ block: 'start' }))
await desk.waitForTimeout(400)
const nav = desk.locator('nav[aria-label="Table of contents"]:visible')
await nav.screenshot({ path: 'output/blog-detail-concepts/verify/desktop-toc.png' })
const metrics = async (page) => page.locator('nav[aria-label="Table of contents"]:visible').evaluate((n) => {
  const pick = (a) => { const s = getComputedStyle(a); const b = a.getBoundingClientRect(); return { text: a.textContent.slice(0, 24), h: Math.round(b.height), size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, pad: s.paddingTop + ' ' + s.paddingLeft, color: s.color, border: s.borderLeftWidth + ' ' + s.borderLeftColor } }
  const links = [...n.querySelectorAll('a')]
  return { first: pick(links[0]), active: pick(n.querySelector('a[aria-current]')), nested: pick(n.querySelector('li[class*="nested"] a') ?? links[0]), transition: getComputedStyle(links[0]).transition, count: links.length }
})
console.log('DESKTOP', JSON.stringify(await metrics(desk)))
await desk.locator('nav[aria-label="Table of contents"]:visible a').nth(4).hover()
await desk.waitForTimeout(300)
await nav.screenshot({ path: 'output/blog-detail-concepts/verify/desktop-toc-hover.png' })
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await mob.goto(url, { waitUntil: 'networkidle' })
await mob.locator('h2[id]').nth(1).evaluate((h) => h.scrollIntoView({ block: 'start' }))
await mob.waitForTimeout(400)
await mob.getByRole('button', { name: 'Table of contents' }).tap()
await mob.waitForTimeout(400)
console.log('MOBILE', JSON.stringify(await metrics(mob)))
await mob.screenshot({ path: 'output/blog-detail-concepts/verify/mobile-toc-open.png' })
await browser.close()
