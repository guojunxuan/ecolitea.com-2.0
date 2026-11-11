// 1:1 screenshots of each stage in the redesign mock, for review.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)

const here = dirname(fileURLToPath(import.meta.url))
// `node shoot.mjs system|compact` shoots <variant>.html into shots-<variant>/.
const variant = ['system', 'compact'].includes(process.argv[2]) ? process.argv[2] : 'free'
const outDir = join(here, variant === 'free' ? 'shots' : `shots-${variant}`)
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1540, height: 1000 }, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(join(here, variant === 'free' ? 'index.html' : `${variant}.html`)).href)
await page.evaluate(() => document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')))
await page.waitForTimeout(2500)

const names = ['bar-dark', 'bar-white', 'products', 'interest', 'professional', 'support', 'mobile']
const stages = page.locator('.stage, .mStage')
const n = await stages.count()
let k = 0
for (let i = 0; i < n; i++) {
  await stages.nth(i).screenshot({ path: join(outDir, `${names[k++] ?? 'stage-' + i}.png`) })
}
console.log('shot', n)
await browser.close()
