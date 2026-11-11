// Header mock, third pass: "compact + brand". Built on the real token and
// type-role files like system.html, with a different layout: every menu shares
// one frame (statement aside | content), the nav sits with the logo, and the
// panels are roughly half as tall. Deviations from the system are listed on the
// page and marked "deviation" in compact.css.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '../..')
const j = (f) => JSON.parse(readFileSync(join(here, f), 'utf8'))
const content = j('content.json')
const products = j('products.json')
const imgMap = j('img-map.json')
const font = readFileSync(join(here, 'Geist-Variable.woff2')).toString('base64')

const menu = (label) => content.menus.find((m) => m.label === label).data
const src = (u) => imgMap[u] ?? ''
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// Boxed product shots get a tile in their own box colour (see build.mjs).
const { default: sharp } = await import(
  new URL('../../node_modules/.pnpm/sharp@0.35.4_@types+node@24.12.3/node_modules/sharp/dist/index.mjs', import.meta.url).href
)
const opaqueBg = {}
for (const f of new Set(Object.values(imgMap))) {
  const { data, info } = await sharp(join(here, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const c = data.subarray((2 * info.width + 2) * 4, (2 * info.width + 2) * 4 + 4)
  if (c[3] === 255) opaqueBg[f] = `rgb(${c[0]},${c[1]},${c[2]})`
}

/* ------------------------------------------------------------- components */

const arrow = `<svg class="arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const cta = (label, extra = '') => `<a class="cta ${extra}" href="#">${esc(label)}${arrow}</a>`

const card = (c, kind) => {
  const box = kind === 'product' ? opaqueBg[src(c.img)] : undefined
  return `
<a class="card" href="#">
  <span class="media" data-kind="${kind}"${box ? ` style="background:${box}"` : ''}>
    ${src(c.img) ? `<img src="${src(c.img)}" alt="">` : ''}
  </span>
  <span class="cardTitle">${esc(c.title)}</span>
</a>`
}

const linkGroup = (g) => `
<div class="group">
  <p class="eyebrow">${esc(g.heading)}</p>
  <ul class="links">${g.links.map((l) => `<li><a class="link" href="#">${esc(l)}</a></li>`).join('')}</ul>
</div>`

// The one frame every menu uses: statement on the left, content on the right.
const frame = (label, top, bottom, main) => `
<div class="panel">
  <div class="shell frame">
    <div class="aside">
      <div class="asideTop"><p class="eyebrow">${esc(label)}</p>${top}</div>
      ${bottom}
    </div>
    <div class="main">${main}</div>
  </div>
</div>
<div class="behind" aria-hidden="true" style="background-image:url(${src(menu('Shop by Interest').visualCards[4].img)})"></div>`

const statement = (label, text, ctaLabel) => [label, `<h2 class="statement">${esc(text)}</h2>`, cta(ctaLabel)]

/* ------------------------------------------------------------ mega menus */

const productsMenu = frame(
  'Products',
  `<ul class="tabs">
    ${products
      .map(
        (p, i) =>
          `<li><button type="button" class="tab" ${i === 0 ? 'data-active="true"' : ''}>${esc(p.tab)}</button></li>`,
      )
      .join('')}
  </ul>`,
  `<div class="asideCtas">${cta('Explore all cameras')}${cta('Compare 360° cameras')}</div>`,
  `<div class="grid">${products[0].cards.map((c) => card(c, 'product')).join('')}</div>`,
)

const interestMenu = frame(
  ...statement('Shop by Interest', 'Find your next adventure', 'View all interests'),
  `<div class="grid">${menu('Shop by Interest').visualCards.map((c) => card(c, 'photo')).join('')}</div>`,
)

const directoryMenu = (label, title, ctaLabel) => {
  const d = menu(label)
  return frame(
    ...statement(label, title, ctaLabel),
    `<div class="grid groups">${d.linkGroups.map(linkGroup).join('')}</div>
     <div class="grid featured">${d.visualCards.map((c) => card(c, 'feature')).join('')}</div>`,
  )
}

/* ---------------------------------------------------------------- header */

const logoMark = `<span class="logo"><span class="logoWord">ECOLITEA</span><span class="logoTag">ILLUMINATE THE FUTURE</span></span>`
const searchIcon = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="5.25" stroke="currentColor" stroke-width="1.4"/><path d="m13 13 3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`

const bar = (state, activeIndex = -1) => `
<div class="bar" data-state="${state}"${state === 'dark' ? ' data-website-theme="inverse"' : ''}>
  <div class="shell barInner">
    <a class="brand" href="#">${logoMark}</a>
    <nav class="nav">
      ${['Products', 'Accessories', 'Shop by Interest', 'Professional', 'Support']
        .map((l, i) => `<a class="navLink" href="#" ${i === activeIndex ? 'data-active="true"' : ''}>${esc(l)}</a>`)
        .join('')}
    </nav>
    <div class="actions">
      <button class="iconBtn" type="button" aria-label="Search">${searchIcon}</button>
      <a class="pill" href="#">Request a Quote</a>
    </div>
  </div>
</div>`

/* ---------------------------------------------------------------- mobile */

const chev = `<svg class="chev" viewBox="0 0 16 16" fill="none"><path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const mobile = `
<div class="m">
  <div class="mBar">
    <button class="mIcon" type="button" aria-label="Close"><svg viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>
    ${logoMark}
    <button class="mIcon" type="button" aria-label="Search">${searchIcon}</button>
  </div>
  <div class="mBody">
    <div class="mItem" data-open="true">
      <button class="mTop" type="button">Products${chev}</button>
      <div class="mPanel">
        <div class="mRail">${products[0].cards.slice(0, 6).map((c) => card(c, 'product')).join('')}</div>
        <ul class="mSub">${products.map((p) => `<li><a class="mLink" href="#">${esc(p.tab)}${arrow}</a></li>`).join('')}</ul>
        ${cta('Explore all cameras', 'mCta')}
      </div>
    </div>
    ${['Accessories', 'Shop by Interest', 'Professional', 'Support']
      .map((l) => `<div class="mItem"><button class="mTop" type="button">${esc(l)}${chev}</button></div>`)
      .join('')}
  </div>
  <div class="mFoot"><a class="pillSolid" href="#">Request a Quote</a></div>
</div>`

/* ------------------------------------------------------------------ page */

const css = [
  `@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-display:block}`,
  readFileSync(join(repo, 'src/styles/tokens.css'), 'utf8'),
  readFileSync(join(repo, 'src/styles/layout.css'), 'utf8').split('@layer base')[0],
  readFileSync(join(repo, 'src/styles/typography.css'), 'utf8'),
  readFileSync(join(here, 'compact.css'), 'utf8'),
].join('\n')

// Global role per element — the HTML equivalent of `composes`.
const roles = {
  navLink: 'caption',
  pill: 'caption',
  statement: 'heading-3',
  tab: 'heading-3',
  cta: 'body-sm',
  eyebrow: 'eyebrow',
  link: 'body-sm',
  cardTitle: 'body-sm',
  mTop: 'heading-3',
  mLink: 'body-sm',
  pillSolid: 'button',
}
const withRoles = (markup) =>
  markup.replace(/class="([^"]+)"/g, (m, list) => {
    const role = list.split(/\s+/).map((c) => roles[c]).find(Boolean)
    return role ? `class="website-type-${role} ${list}"` : m
  })

const spec = (b, body) => `<div class="spec"><b>${b}</b>${body}</div>`
const page = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Header 重设计稿 — 紧凑品牌版</title><style>${css}</style></head>
<body>
<nav class="switch">
  <a href="index.html">自由提案</a>
  <a href="system.html">系统约束版</a>
  <a href="compact.html" aria-current="page">紧凑品牌版</a>
</nav>
<h1 class="pageTitle">Header 重设计稿 — 紧凑品牌版</h1>
<p class="lede">
  回应「不够紧凑、没有品牌感、很散」。仍然加载项目真实的 <code>tokens.css</code> / <code>typography.css</code>，
  只有两处偏离系统（见最后一栏）。
</p>
<div class="specs">
  ${spec('收拢：一个框架', '四个菜单共用同一框架：<strong>左侧宣言 + CTA｜右侧内容</strong>。<br>不再上下叠「链接带 + 细线 + 大图带」。<br>导航贴着 Logo 靠左，不再三段散开。')}
  ${spec('紧凑：高度减半', '面板上下 <code>space-8</code> / <code>space-12</code>（原 48/64）<br>链接行 28px（原 36）<br>面板高度 366–475（系统约束版 649–709），约少三分之一')}
  ${spec('品牌：声音与签名', '左栏大字（宣言 / 产品类目）用 <code>heading-3</code> 22/700 —— 和页面标题同一个粗体声音。<br>菜单名与分组标签用加字距的全大写，呼应 Logo 下的 ILLUMINATE THE FUTURE。<br>选中导航 2px 实线，而不是发丝线。')}
  ${spec('真实：一层菜单', '面板下方是被 <code>scrim-standard</code> 压暗的页面，<br>菜单读作一整块浮层，而不是和页面连在一起的白色区域。')}
  ${spec('偏离系统（2 处）', '① 分组标签在 <code>eyebrow</code> 角色上加了 uppercase + .08em 字距<br>② 顶栏高度桌面端 64（token 为 72）<br>其余全部来自 token 与类型角色。')}
</div>

<div class="rule">顶栏 <span>导航靠左贴 Logo，操作靠右</span></div>
<div class="stage onDark">${bar('dark')}</div>
<div class="stage">${bar('scrolled')}</div>

<div class="rule">Products <span>左侧类目用 22/700 大字作为宣言位；右侧产品 4:3</span></div>
<div class="stage">${bar('open', 0)}${productsMenu}</div>

<div class="rule">Shop by Interest</div>
<div class="stage">${bar('open', 2)}${interestMenu}</div>

<div class="rule">Professional <span>链接与精选在同一侧，上下紧贴，不再用细线分成两块</span></div>
<div class="stage">${bar('open', 3)}${directoryMenu('Professional', 'Built for bigger ideas', 'Explore enterprise solutions')}</div>

<div class="rule">Support</div>
<div class="stage">${bar('open', 4)}${directoryMenu('Support', 'Keep creating with confidence', 'Visit support centre')}</div>

<div class="rule">移动端 390px <span>展开后先给一排可横滑的产品图，再给类目</span></div>
<div class="mStage">${mobile}</div>

<script>
  for (const t of document.querySelectorAll('.mTop')) {
    t.addEventListener('click', () => {
      const i = t.parentElement
      i.dataset.open = i.dataset.open === 'true' ? 'false' : 'true'
    })
  }
  for (const t of document.querySelectorAll('.tab')) {
    t.addEventListener('click', () => {
      for (const o of t.closest('.tabs').querySelectorAll('.tab')) o.removeAttribute('data-active')
      t.dataset.active = 'true'
    })
  }
</script>
</body></html>`

writeFileSync(join(here, 'compact.html'), withRoles(page))
console.log('wrote compact.html', page.length, 'bytes')
