import { chromium } from '@playwright/test'
const browser = await chromium.launch()
for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto('http://localhost:3001/blogs/small-details-better-everyday-products', { waitUntil: 'networkidle' })
  await page.screenshot({ path: `output/blog-detail-concepts/current/${name}.png`, fullPage: true })
}
await browser.close()
