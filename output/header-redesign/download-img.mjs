// Downloads the menu imagery from the dev media host at mock-appropriate sizes.
// GET only, dev bucket (media-dev), nothing is written back.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const imgDir = join(here, 'img')
mkdirSync(imgDir, { recursive: true })

const content = JSON.parse(await (await import('node:fs/promises')).readFile(join(here, 'content.json'), 'utf8'))
const products = JSON.parse(await (await import('node:fs/promises')).readFile(join(here, 'products.json'), 'utf8'))

const urls = new Set()
for (const m of content.menus) {
  if (!m.data) continue
  for (const c of [...m.data.visualCards, ...m.data.productCards, ...m.data.richCards]) if (c.img) urls.add(c.img)
}
for (const p of products) for (const c of p.cards) if (c.img) urls.add(c.img)

// Shrink the Cloudflare transform: the mock never renders above ~600px wide.
const shrink = (u) => u.replace(/width=\d+,height=\d+/, 'width=900,height=900')

const map = {}
let n = 0
for (const u of urls) {
  const key = createHash('sha1').update(u).digest('hex').slice(0, 12) + '.webp'
  map[u] = 'img/' + key
  const dest = join(imgDir, key)
  if (existsSync(dest)) continue
  const res = await fetch(shrink(u))
  if (!res.ok) {
    console.warn('FAIL', res.status, u.slice(0, 90))
    continue
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  n++
}
writeFileSync(join(here, 'img-map.json'), JSON.stringify(map, null, 2))
console.log(`downloaded ${n} new / ${urls.size} total`)
