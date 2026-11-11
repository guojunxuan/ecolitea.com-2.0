import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const { chromium } = await import(
  new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href
)
const here = dirname(fileURLToPath(import.meta.url))
const [dir, rows, out] = process.argv.slice(2)
const cells = rows.split(',').map((r) => {
  const [file, label] = r.split(':')
  return `<figure><figcaption>${label}</figcaption><img src="${dir}/${file}.png"></figure>`
}).join('')
const html = `<style>body{margin:16px;font:14px system-ui;background:#fff;display:grid;grid-template-columns:repeat(2,max-content);gap:16px}
figure{margin:0}figcaption{margin-bottom:6px;color:#555}img{display:block;border:1px solid #ddd}</style>${cells}`
writeFileSync(join(here, '_compose.html'), html)
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 400 } })
await p.goto(pathToFileURL(join(here, '_compose.html')).href); await p.waitForTimeout(300)
await p.screenshot({ path: join(here, out), fullPage: true }); await b.close()
