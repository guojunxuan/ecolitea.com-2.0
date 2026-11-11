const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const root = process.cwd()
const dir = __dirname
const esbuild = require(path.join(root, 'node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild'))
const sharp = require('sharp')

async function main() {
  await esbuild.build({
    bundle: true, packages: 'external', platform: 'node', format: 'cjs', jsx: 'automatic',
    alias: { '@': path.join(root, 'src'), 'next/image': path.join(dir, 'next-image.mjs') }, loader: { '.css': 'local-css' },
    entryPoints: [path.join(dir, 'fixture.tsx')], outfile: path.join(dir, 'fixture.cjs'),
    plugins: [{ name: 'css-scopes', setup(build) {
      build.onLoad({ filter: /\.css$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: args.path.endsWith('.module.css') ? 'local-css' : 'css', resolveDir: path.dirname(args.path) }))
    } }],
    logLevel: 'warning',
  })
  const { renderFixture } = require('./fixture.cjs')
  const images = {}
  for (const [name, color] of [['desktop', '#286760'], ['mobile', '#4b418a']]) {
    images[name] = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: color } }).png().toBuffer()
  }
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:47711')
    if (url.pathname === '/fixture.css') {
      res.setHeader('content-type', 'text/css')
      return res.end(fs.readFileSync(path.join(dir, 'fixture.css')))
    }
    if (url.pathname.endsWith('.png')) {
      res.setHeader('content-type', 'image/png')
      return res.end(images[url.pathname.includes('mobile') ? 'mobile' : 'desktop'])
    }
    res.setHeader('content-type', 'text/html')
    res.end(`<!doctype html><html lang="en" style="--font-geist-sans:Arial,sans-serif"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body>${renderFixture(url.searchParams.get('case') || 'override')}</body></html>`)
  }).listen(47711, '127.0.0.1', () => console.log('Hero fixture ready on http://127.0.0.1:47711; production components, synthetic images, no database or remote storage'))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
