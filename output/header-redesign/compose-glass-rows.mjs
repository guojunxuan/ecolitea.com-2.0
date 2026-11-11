import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
const { chromium } = await import(new URL('../../node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs', import.meta.url).href)
const dir = join(import.meta.dirname, 'glass-rows')
const img = (f, crop) => `<div class="c"><div class="v" style="height:${crop.h}px"><img src="${pathToFileURL(join(dir, f)).href}" style="margin-top:-${crop.y}px"></div></div>`
const sheet = (title, rows) => `<html><body style="margin:0;padding:24px;background:#fff;font:14px/1.4 -apple-system,sans-serif;width:1500px">
<style>.v{overflow:hidden;width:1440px;border:1px solid #ddd}.v img{display:block;width:1440px}h3{margin:20px 0 6px;font-size:16px}</style>
<h2 style="margin:0">${title}</h2>${rows.map(([t, f, c]) => `<h3>${t}</h3>${img(f, c)}`).join('')}</body></html>`
const full = { y: 0, h: 500 }, links = { y: 340, h: 240 }
const pages = {
  'compare-glass.png': sheet('毛玻璃：深色 Hero 上打开 Products', [
    ['① 现状：82% 白 · blur 实际未生效（Chrome）', 'g0-products-top.png', full],
    ['② 只修复 blur，参数不变：82% 白 + blur 28px', 'g0fix-products-top.png', full],
    ['③ 推荐：修复 blur + 面板与 Header 栏统一为 94% 白', 'g1-products-top.png', full],
    ['④ 实心白：去掉玻璃', 'g2-products-top.png', full],
  ]),
  'compare-glass-scrolled.png': sheet('毛玻璃：页面滚动后打开 Products（下方有图片）', [
    ['① 现状：图片未模糊，直接透出', 'g0-products-scrolled.png', full],
    ['② 修复 blur 后：图片变成柔和色块', 'g0fix-products-scrolled.png', full],
  ]),
  'compare-rows.png': sheet('桌面链接行高：Professional 面板（面板总高 477 / 493 / 509px）', [
    ['32px（现状）', 'r32-professional.png', links],
    ['36px（+16px）', 'r36-professional.png', links],
    ['40px（规范 §9.1，+32px）', 'r40-professional.png', { y: 340, h: 260 }],
  ]),
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1550, height: 800 } })
for (const [out, html] of Object.entries(pages)) {
  const f = join(dir, out + '.html'); writeFileSync(f, html)
  await page.goto(pathToFileURL(f).href); await page.waitForTimeout(300)
  await page.screenshot({ path: join(dir, out), fullPage: true })
}
await browser.close(); console.log('ok')
