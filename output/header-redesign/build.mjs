// Header redesign mock — a free visual proposal, deliberately NOT bound to the
// current --website-* tokens or the 11 global type roles. Its own scale is
// declared once at the top of the stylesheet and used everywhere, so the whole
// point of the exercise (one ladder, four menus) is visible in the CSS itself.
//
// Content and imagery are the real ones, pulled off the dev server.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const j = (f) => JSON.parse(readFileSync(join(here, f), 'utf8'))
const content = j('content.json')
const products = j('products.json')
const imgMap = j('img-map.json')
const font = readFileSync(join(here, 'Geist-Variable.woff2')).toString('base64')

const menu = (label) => content.menus.find((m) => m.label === label).data
const src = (u) => imgMap[u] ?? ''
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// Most product shots are transparent cut-outs; a few ship baked onto a near-white
// box. For those the tile takes the box colour, so no inner rectangle shows and
// the product keeps the same inset as every other card. (In production this becomes a content rule: product
// cards want transparent cut-outs.)
const { default: sharp } = await import(
  new URL('../../node_modules/.pnpm/sharp@0.35.4_@types+node@24.12.3/node_modules/sharp/dist/index.mjs', import.meta.url).href
)
const opaqueBg = {}
for (const f of new Set(Object.values(imgMap))) {
  const { data, info } = await sharp(join(here, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x, y) => data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)
  const c = at(2, 2)
  if (c[3] === 255) opaqueBg[f] = `rgb(${c[0]},${c[1]},${c[2]})`
}

/* ------------------------------------------------------------- components */

const arrow = `<svg class="arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const panelHead = (title, cta) => `
<div class="panelHead">
  <h2 class="panelTitle">${esc(title)}</h2>
  ${cta ? `<a class="cta" href="#">${esc(cta)}${arrow}</a>` : ''}
</div>`

const linkGroup = (g) => `
<div class="group">
  <p class="eyebrow">${esc(g.heading)}</p>
  <ul class="links">${g.links.map((l) => `<li><a class="link" href="#">${esc(l)}</a></li>`).join('')}</ul>
</div>`

// One card, one shape: media tile on a neutral surface, caption underneath,
// left-aligned. No scrim, no white-on-photo text, no outlined box.
const card = (c, { fit = 'cover', ratio = '3 / 2' } = {}) => {
  const box = fit === 'contain' ? opaqueBg[src(c.img)] : undefined
  return `
<a class="card" href="#">
  <span class="media" style="aspect-ratio:${ratio}${box ? `;background:${box}` : ''}" data-fit="${fit}">
    ${src(c.img) ? `<img src="${src(c.img)}" alt="" loading="lazy">` : ''}
  </span>
  <span class="cardTitle">${esc(c.title)}</span>
</a>`
}

/* ------------------------------------------------------------ mega menus */

const productsMenu = (() => {
  const active = products[0]
  return `
<div class="panel">
  <div class="shell">
    <div class="tabsLayout">
      <div class="rail">
        <ul class="railList">
          ${products
            .map(
              (p, i) =>
                `<li><button type="button" class="tab" ${i === 0 ? 'data-active="true"' : ''}>${esc(p.tab)}</button></li>`,
            )
            .join('')}
        </ul>
        <a class="cta railCta" href="#">Explore all cameras${arrow}</a>
      </div>
      <div class="tabContent">
        ${panelHead(active.tab, 'Compare 360° cameras')}
        <div class="grid grid4 gridProduct">
          ${active.cards.map((c) => card(c, { fit: 'contain', ratio: '1 / 1' })).join('')}
        </div>
      </div>
    </div>
  </div>
</div>`
})()

const interestMenu = (() => {
  const d = menu('Shop by Interest')
  return `
<div class="panel">
  <div class="shell">
    ${panelHead('Find your next adventure', 'View all interests')}
    <div class="grid grid4">${d.visualCards.map((c) => card(c)).join('')}</div>
  </div>
</div>`
})()

const directoryMenu = (label, title, cta, featuredLabel) => {
  const d = menu(label)
  return `
<div class="panel">
  <div class="shell">
    ${panelHead(title, cta)}
    <div class="grid grid4">${d.linkGroups.map(linkGroup).join('')}</div>
    <div class="featured">
      <p class="eyebrow">${esc(featuredLabel)}</p>
      <div class="grid grid4">${d.visualCards.map((c) => card(c)).join('')}</div>
    </div>
  </div>
</div>`
}

/* ---------------------------------------------------------------- header */

const logoMark = `<span class="logo"><span class="logoWord">ECOLITEA</span><span class="logoTag">ILLUMINATE THE FUTURE</span></span>`

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
      <button class="iconBtn" type="button" aria-label="Search">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="5.25" stroke="currentColor" stroke-width="1.4"/><path d="m13 13 3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
      <a class="pill" href="#">Request a Quote</a>
    </div>
  </div>
</div>`

/* ---------------------------------------------------------------- mobile */

const mobile = `
<div class="m">
  <div class="mBar">
    <button class="mIcon" type="button" aria-label="Close">
      <svg viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    </button>
    ${logoMark}
    <button class="mIcon" type="button" aria-label="Search">
      <svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.25" stroke="currentColor" stroke-width="1.4"/><path d="m13 13 3.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    </button>
  </div>
  <div class="mBody">
    <div class="mItem" data-open="true">
      <button class="mTop" type="button">Products<svg class="chev" viewBox="0 0 16 16" fill="none"><path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="mPanel">
        <ul class="mSub">
          ${products.map((p) => `<li><a class="mLink" href="#">${esc(p.tab)}${arrow}</a></li>`).join('')}
        </ul>
        <a class="cta mCta" href="#">Explore all cameras${arrow}</a>
      </div>
    </div>
    ${['Accessories', 'Shop by Interest', 'Professional', 'Support']
      .map(
        (l) =>
          `<div class="mItem"><button class="mTop" type="button">${esc(l)}<svg class="chev" viewBox="0 0 16 16" fill="none"><path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`,
      )
      .join('')}
  </div>
  <div class="mFoot"><a class="pillSolid" href="#">Request a Quote</a></div>
</div>`

/* ------------------------------------------------------------------- css */

const css = String.raw`
@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-display:block}

/* =====================================================================
   The proposal's own scale. One ladder, used by every menu.
   ===================================================================== */
:root{
  --ink:#1d1d1f;          /* titles, links — the only near-black */
  --muted:#6e6e73;        /* descriptions */
  --faint:#86868b;        /* group labels, inactive tabs */
  --hairline:#e5e5e7;
  --surface:#f5f5f7;      /* media tiles only */
  --panel:#ffffff;

  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px;
  --s6:24px; --s8:32px; --s10:40px; --s12:48px; --s16:64px;

  --r-media:14px;         /* the single radius in the whole header */
  --r-pill:999px;
  --bar-h:64px;
  --site:1220px;
  --ease:cubic-bezier(.2,.8,.2,1);
}

/* type roles — five, and that is the whole set */
.eyebrow{font-size:12px;font-weight:600;line-height:16px;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}
.panelTitle{font-size:19px;font-weight:500;line-height:26px;letter-spacing:-.012em;color:var(--ink)}
.links a,.tab{font-size:15px;font-weight:400;line-height:20px;letter-spacing:0}
.cardTitle{font-size:15px;font-weight:500;line-height:20px;letter-spacing:-.005em;color:var(--ink)}
.cta{font-size:14px;font-weight:500;line-height:20px;letter-spacing:0;color:var(--ink)}

/* ---- reset + review chrome ---- */
*,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}
ul{list-style:none} a{color:inherit;text-decoration:none} img,svg{display:block}
button{font:inherit;color:inherit;background:none;cursor:pointer}
body{font-family:'Geist',system-ui,sans-serif;background:#ececee;color:var(--ink);padding:40px 40px 140px;-webkit-font-smoothing:antialiased}
h1{font-size:26px;font-weight:600;letter-spacing:-.02em}
.lede{font-size:14px;line-height:1.65;color:#55555c;margin-top:10px;max-width:60rem}
.lede code{font-family:ui-monospace,monospace;font-size:12px;background:#dededf;padding:1px 5px;border-radius:4px}
.rule{display:flex;align-items:baseline;gap:12px;margin:48px 0 14px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3c3c42}
.rule span{font-weight:400;letter-spacing:0;text-transform:none;color:#76767e}
.stage{width:1440px;max-width:100%;outline:1px solid #d9d9dc;overflow:hidden}
.onDark{background:#0c0c0d}
.mStage{width:390px;outline:1px solid #d9d9dc}
.specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px;margin-top:16px}
.spec{background:#fff;border:1px solid #e0e0e3;border-radius:10px;padding:14px 16px;font-size:12px;line-height:1.7;color:#55555c}
.spec b{display:block;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8d8d95;font-weight:600;margin-bottom:6px}
.spec code{font-family:ui-monospace,monospace;font-size:11px}
.switch{display:flex;gap:6px;margin-bottom:24px}
.switch a{font-size:13px;padding:6px 12px;border-radius:999px;border:1px solid #d4d4d7;color:#55555c}
.switch a[aria-current]{background:#262629;border-color:#262629;color:#fff}

.shell{width:min(100% - 80px,var(--site));margin-inline:auto}

/* =============================================================== header */
.bar{background:var(--panel);color:var(--ink)}
.bar[data-state='dark']{background:transparent;color:#fff}
.bar[data-state='scrolled']{border-bottom:1px solid var(--hairline)}
.barInner{display:flex;align-items:center;gap:var(--s10);height:var(--bar-h)}

.logo{display:flex;flex-direction:column;gap:3px}
.logoWord{font-size:17px;font-weight:700;letter-spacing:.11em;line-height:1}
.logoTag{font-size:7px;font-weight:500;letter-spacing:.2em;line-height:1;opacity:.6}

.nav{display:flex;align-items:center;gap:var(--s8);margin-inline:auto}
.navLink{font-size:14px;font-weight:400;line-height:20px;letter-spacing:0;position:relative;height:var(--bar-h);display:inline-flex;align-items:center;color:inherit;opacity:.82;transition:opacity 160ms var(--ease)}
.navLink:hover,.navLink[data-active='true']{opacity:1}
/* the indicator is a hairline, not a 2px bar */
.navLink[data-active='true']::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:currentColor}

.actions{display:flex;align-items:center;gap:var(--s3);flex:0 0 auto}
.iconBtn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-pill);color:inherit;opacity:.82;transition:opacity 160ms var(--ease)}
.iconBtn:hover{opacity:1}
.iconBtn svg{width:20px;height:20px}
/* the ONE button shape in the entire header */
.pill{font-size:13px;font-weight:500;line-height:18px;letter-spacing:.005em;border:1px solid currentColor;border-radius:var(--r-pill);padding:9px 18px;white-space:nowrap;transition:background-color 160ms var(--ease),color 160ms var(--ease)}
.bar[data-state='dark'] .pill:hover{background:#fff;color:#0c0c0d}
.bar:not([data-state='dark']) .pill:hover{background:var(--ink);color:#fff}

/* ============================================================ mega menu */
.panel{background:var(--panel);border-top:1px solid var(--hairline);padding-block:var(--s12) var(--s16)}

.panelHead{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s6);margin-bottom:var(--s8)}

/* CTAs are text + arrow. No outlines anywhere below the header bar. */
.cta{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
.cta .arrow{width:16px;height:16px;transition:transform 180ms var(--ease)}
.cta:hover .arrow{transform:translateX(3px)}

.grid{display:grid;min-width:0}
.grid4{grid-template-columns:repeat(4,minmax(0,1fr));column-gap:var(--s6);row-gap:var(--s10)}

.group{min-width:0}
.group .eyebrow{margin-bottom:var(--s4)}
.links{display:flex;flex-direction:column}
.links a{display:block;color:var(--ink);padding-block:7px;opacity:.88;transition:opacity 140ms var(--ease)}
.links a:hover{opacity:1}

/* ---- the single card ---- */
.card{display:flex;flex-direction:column;gap:var(--s3);min-width:0}
.media{display:block;width:100%;overflow:hidden;border-radius:var(--r-media);background:var(--surface)}
.media img{width:100%;height:100%;object-fit:cover;transition:transform 420ms var(--ease)}
/* Cut-outs float on the tile; boxed shots get a tile in their own box colour. */
.media[data-fit='contain'] img{object-fit:contain;padding:9%}
.card:hover .media img{transform:scale(1.03)}
.cardTitle{display:block}

/* featured strip: separated by whitespace and one hairline, not a slab */
.featured{margin-top:var(--s12);padding-top:var(--s8);border-top:1px solid var(--hairline)}
.featured .eyebrow{margin-bottom:var(--s5)}

/* ---- category tabs ---- */
.tabsLayout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:var(--s16)}
.rail{display:flex;flex-direction:column;align-items:flex-start;gap:var(--s6)}
.railList{display:flex;flex-direction:column;width:100%}
.tab{display:block;width:100%;text-align:left;padding-block:9px;color:var(--faint);transition:color 140ms var(--ease)}
.tab:hover{color:var(--ink)}
.tab[data-active='true']{color:var(--ink);font-weight:500}
/* pinned to the list, not to the bottom of the panel */
.railCta{margin-top:var(--s2)}

.gridProduct{column-gap:var(--s6);row-gap:var(--s8)}

/* ================================================================ mobile */
.m{background:var(--panel);display:flex;flex-direction:column;height:760px}
.mBar{display:flex;align-items:center;justify-content:space-between;height:56px;padding-inline:var(--s5);border-bottom:1px solid var(--hairline)}
.mIcon{width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin-inline:-10px}
.mIcon svg{width:20px;height:20px}
.mBody{flex:1 1 auto;overflow-y:auto;padding-inline:var(--s5)}
.mItem{border-bottom:1px solid var(--hairline)}
.mTop{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:56px;font-size:17px;font-weight:500;letter-spacing:-.01em;text-align:left}
.mTop .chev{width:16px;height:16px;color:var(--faint);transition:transform 220ms var(--ease)}
.mItem[data-open='true'] .mTop .chev{transform:rotate(180deg)}
.mPanel{padding-bottom:var(--s5)}
.mSub a{display:flex;align-items:center;justify-content:space-between;min-height:48px;font-size:15px;font-weight:400;color:var(--ink);opacity:.88}
.mSub .arrow{width:16px;height:16px;color:var(--faint)}
.mCta{display:inline-flex;margin-top:var(--s3)}
.mFoot{padding:var(--s3) var(--s5) var(--s5);border-top:1px solid var(--hairline)}
.pillSolid{display:flex;align-items:center;justify-content:center;min-height:50px;border-radius:var(--r-pill);background:var(--ink);color:#fff;font-size:15px;font-weight:500}
`

/* ------------------------------------------------------------------ page */

const spec = (b, body) => `<div class="spec"><b>${b}</b>${body}</div>`
const switcher = (current) => `<nav class="switch">
  <a href="index.html"${current === 'free' ? ' aria-current="page"' : ''}>自由提案</a>
  <a href="system.html"${current === 'system' ? ' aria-current="page"' : ''}>系统约束版</a>
  <a href="compact.html">紧凑品牌版</a>
</nav>`

const freePage = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Header 重设计稿</title><style>${css}</style></head>
<body>
${switcher('free')}
<h1>Header 重设计稿 — 自由提案</h1>
<p class="lede">
  这一版<strong>不受现有 <code>--website-*</code> token 和 11 个全局类型角色约束</strong>，先把方向画出来。
  内容与图片是 <code>localhost:3001</code> 上的真实数据。四个菜单共用同一套阶梯，下面每一栏都是这套阶梯的具体数字。
</p>
<div class="specs">
  ${spec('类型阶梯（共 5 级）', '分组标签 12/600/.09em 大写 faint<br>面板标题 19/500/-.012em ink<br>链接与 tab 15/400<br>卡片标题 15/500<br>CTA 14/500')}
  ${spec('颜色（共 4 档）', 'ink <code>#1d1d1f</code> 标题链接<br>muted <code>#6e6e73</code> 描述<br>faint <code>#86868b</code> 标签与未选 tab<br>hairline <code>#e5e5e7</code>')}
  ${spec('形状', '整个 Header 只有<strong>一种按钮</strong>：顶栏药丸。<br>菜单内所有 CTA 是「文字 + 箭头」。<br>圆角只有一个值：媒体图 14px。')}
  ${spec('间距', '4 的倍数。面板 48/64，列间距 24，行间距 40。<br>卡片网格<strong>行距大于列距</strong>（现状相反）。')}
  ${spec('卡片', '一种形状：媒体图 + 12px + 标题，<strong>全部左对齐</strong>。<br>取消压图白字与渐变遮罩，取消灰底卡壳。<br>灰色只留在媒体图底衬上。')}
  ${spec('层级来源', '标题与链接同为 ink，靠<strong>字号 + 字重 + 大写标签</strong>分层，<br>不靠框、不靠底色。')}
</div>

<div class="rule">顶栏 <span>深色 hero 上（透明） / 白底（滚动后）</span></div>
<div class="stage onDark">${bar('dark')}</div>
<div class="stage">${bar('scrolled')}</div>

<div class="rule">Products <span>左侧类目 + 产品网格。CTA 紧跟类目列表，不再沉底留 280px 空洞</span></div>
<div class="stage">${bar('open', 0)}${productsMenu}</div>

<div class="rule">Shop by Interest <span>纯卡片。标题移到图下方，取消遮罩压字</span></div>
<div class="stage">${bar('open', 2)}${interestMenu}</div>

<div class="rule">Professional <span>链接目录在上，精选卡片在下 —— 与 Support 同一个模板</span></div>
<div class="stage">${bar('open', 3)}${directoryMenu('Professional', 'Built for bigger ideas', 'Explore enterprise solutions', 'Featured')}</div>

<div class="rule">Support <span>与 Professional 顺序一致（现状是反的）</span></div>
<div class="stage">${bar('open', 4)}${directoryMenu('Support', 'Keep creating with confidence', 'Visit support centre', 'Featured')}</div>

<div class="rule">移动端 390px <span>一级 17/500（现状 20/600），二级 15/400，底部实心药丸</span></div>
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
      for (const o of t.closest('.railList').querySelectorAll('.tab')) o.removeAttribute('data-active')
      t.dataset.active = 'true'
    })
  }
</script>
</body></html>`



writeFileSync(join(here, 'index.html'), freePage)
console.log('wrote index.html', freePage.length, 'bytes')

/* ------------------------------------------------ system-constrained variant */

// Same markup, but styled only with the real token + type-role files. Each
// element gets its global role class next to its own class, which is what
// `composes: website-type-* from global` compiles to in the CSS Modules build.
const repo = join(here, '../..')
const systemCss = [
  `@font-face{font-family:'Geist';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-display:block}`,
  readFileSync(join(repo, 'src/styles/tokens.css'), 'utf8'),
  readFileSync(join(repo, 'src/styles/layout.css'), 'utf8').split('@layer base')[0], // gutters only
  readFileSync(join(repo, 'src/styles/typography.css'), 'utf8'),
  readFileSync(join(here, 'system.css'), 'utf8'),
].join('\n')

const roles = {
  navLink: 'caption',
  pill: 'caption', // button role (16/500) outshouts the 14px nav in a 40px control
  panelTitle: 'title',
  cta: 'body-sm', // text + arrow; button role sat too close to the 20/600 title
  eyebrow: 'eyebrow',
  link: 'body-sm',
  tab: 'body-sm',
  cardTitle: 'body-md',
  mTop: 'button',
  mLink: 'body-sm',
  pillSolid: 'button',
}
const withRoles = (markup) =>
  markup.replace(/class="([^"]+)"/g, (m, list) => {
    const role = list.split(/\s+/).map((c) => roles[c]).find(Boolean)
    return role ? `class="website-type-${role} ${list}"` : m
  })

const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`
const systemPage = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Header 重设计稿 — 系统约束版</title><style>${systemCss}</style></head>
<body>
${switcher('system')}
<h1 class="pageTitle">Header 重设计稿 — 系统约束版</h1>
<p class="lede">
  结构、卡片和版式与自由提案相同，但<strong>只使用现有系统</strong>：页面直接加载项目里的
  <code>src/styles/tokens.css</code>、<code>layout.css</code> 和 <code>typography.css</code>，组件样式只引用
  <code>--website-*</code> token；文字全部来自 11 个全局类型角色，没有任何自定义字号、字重、行高或字距。
  这就是之后落到 <code>src/Header</code> 时能直接照抄的版本。
</p>
<div class="specs">
  ${spec('类型：只用 11 个角色中的 6 个', '顶栏导航 <code>caption</code> 14/400<br>面板标题 <code>title</code> 20/600<br>分组标签 <code>eyebrow</code> 12/600<br>链接 · 类目 tab · 文字 CTA · 移动端二级 <code>body-sm</code> 15/400<br>卡片标题 <code>body-md</code> 16/400<br>顶栏按钮 <code>caption</code> 14/400（与导航同级）<br>移动端一级 · 底部按钮 <code>button</code> 16/500')}
  ${spec('颜色：4 个语义 token', '<code>foreground</code> 标题、链接<br><code>muted-foreground</code> 分组标签、未选 tab<br><code>border</code> 细线　<code>muted-surface</code> 图片底衬<br><code>subtle-foreground</code> 不用：白底上对比度 2.7:1，不满足 AA')}
  ${spec('高度', '顶栏 <code>--header-height</code> 60 / 64 / 72<br>搜索与顶栏按钮 <code>control-compact</code> 40<br>移动端一级 <code>control-large</code> 56<br>移动端二级与底部按钮 <code>control-default</code> 48')}
  ${spec('间距', '面板 <code>space-12</code> / <code>space-16</code>（48/64）<br>列距 <code>space-6</code> 24，行距 <code>space-8</code> 32<br>（自由稿的 40 不在 token 里，取 32）<br>图 → 标题 <code>space-3</code> 12')}
  ${spec('形状与材质', '图片 <code>radius-content</code> 12<br>按钮与 Footer 同一形状：<code>radius-control</code> 8<br>面板用 <code>glass-*</code> token：90% 白 / 18px / 115%<br>（现状手写 82% / 28px / 120%）')}
  ${spec('非 token 值（几何）', '左栏宽 13.75rem（现状 220px）<br>产品图内边距 9%<br>Logo 为品牌素材，不走类型角色')}
</div>

<div class="rule">顶栏 <span>深色 hero 上用 data-website-theme="inverse" 反色 / 滚动后白底 + 细线</span></div>
<div class="stage onDark">${bar('dark')}</div>
<div class="stage">${bar('scrolled')}</div>

<div class="rule">Products <span>左侧类目 body-sm，选中只变颜色（角色不允许改字重）</span></div>
<div class="stage">${bar('open', 0)}${productsMenu}</div>

<div class="rule">Shop by Interest <span>卡片标题 body-md，比链接大一级</span></div>
<div class="stage">${bar('open', 2)}${interestMenu}</div>

<div class="rule">Professional <span>eyebrow 保持角色原样，不做大写（角色字距 .125px 不适合全大写）</span></div>
<div class="stage">${bar('open', 3)}${directoryMenu('Professional', 'Built for bigger ideas', 'Explore enterprise solutions', 'Featured')}</div>

<div class="rule">Support <span>与 Professional 同一模板</span></div>
<div class="stage">${bar('open', 4)}${directoryMenu('Support', 'Keep creating with confidence', 'Visit support centre', 'Featured')}</div>

<div class="rule">移动端 390px <span>一级 button 16/500 @56，二级 body-sm 15/400 @48，底部 Button default</span></div>
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
      for (const o of t.closest('.railList').querySelectorAll('.tab')) o.removeAttribute('data-active')
      t.dataset.active = 'true'
    })
  }
</script>
</body></html>`

writeFileSync(join(here, 'system.html'), withRoles(systemPage))
console.log('wrote system.html', systemPage.length, 'bytes')
