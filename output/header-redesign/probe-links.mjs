const { chromium } = await import(new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:3001/', { waitUntil: 'load', timeout: 90000 })
const bs = page.locator('header nav button[aria-expanded]:visible')
for (let i = 0; i < await bs.count(); i++) {
  await page.keyboard.press('Escape'); await page.mouse.move(5, 880); await page.waitForTimeout(300)
  await bs.nth(i).click(); await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('[class*="megaMenu"] [class*="linkList"]')].filter((l) => l.offsetParent)
    const inner = document.querySelector('[class*="megaMenuInner"]')?.parentElement?.getBoundingClientRect()
    return { lists: lists.map((l) => l.children.length), panel: inner && Math.round(inner.height), rowH: lists[0] && Math.round(lists[0].querySelector('a').getBoundingClientRect().height) }
  })
  console.log(await bs.nth(i).innerText(), JSON.stringify(r))
}
await browser.close()
