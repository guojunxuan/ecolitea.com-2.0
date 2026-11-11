// Self-contained file:// preview of the real Footer.
//
// The stylesheet is NOT transcribed: it is read from src/Footer/index.module.css
// at build time, with `composes: website-type-* from global` resolved against
// src/styles/typography.css and viewport media queries rewritten as container
// queries so each stage renders its own responsive state. What you see is what
// the module actually declares.
//
// Content is a snapshot of the local dev database (ecolitea2) taken 2026-09-28.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')
const read = (p) => readFileSync(join(repo, p), 'utf8')

/* ------------------------------------------------------------------ styles */

const typography = read('src/styles/typography.css')
const roles = new Map()
for (const m of typography.matchAll(/\.website-type-([a-z0-9-]+)\s*\{([^}]*)\}/g)) {
  roles.set(m[1], m[2].trim())
}

const footerSource = read('src/Footer/index.module.css')

const footerCss = footerSource
  .replace(/composes:\s*website-type-([a-z0-9-]+)\s+from\s+global;/g, (_, role) => {
    const body = roles.get(role)
    if (!body) throw new Error(`unknown type role: ${role}`)
    return `/* composes ${role} */ ${body}`
  })
  // Stages are narrower than the window, so responsive state must key off the
  // stage box rather than the viewport.
  .replace(/@media \(width /g, '@container (width ')

/* ----------------------------------------------------------------- assets */

const font = readFileSync(join(here, 'Geist-Variable.woff2')).toString('base64')
const dataUri = (name) =>
  `data:image/svg+xml;base64,${readFileSync(join(here, 'assets', name)).toString('base64')}`

const logo = dataUri('ecolitea-logo-dark-2.svg')
const socials = [
  ['LinkedIn', 'social-linkedin-1.svg'],
  ['YouTube', 'social-youtube-1.svg'],
  ['Facebook', 'social-facebook-1.svg'],
  ['Instagram', 'social-instagram-1.svg'],
  ['X', 'social-x-1.svg'],
].map(([name, file]) => ({ name, uri: dataUri(file) }))

/* ---------------------------------------------------------------- content */

const content = {
  siteDescription:
    'Ecolitea is a B2B company providing reliable products and tailored solutions to customers worldwide.',
  columns: [
    {
      label: 'Products',
      items: ['Product 01', 'Product 02', 'Product 03', 'Product 04', 'Product 05', 'Product 06', 'Product 07', 'Product 08'],
    },
    { label: 'Solutions', items: ['Hospitality', 'Commercial', 'Residential', 'Custom projects'] },
    { label: 'Resources', items: ['Example page', 'Example post', 'Downloads', 'External resource'] },
    { label: 'Company', items: ['About us', 'Contact', 'Partner portal'] },
  ],
  newsletter: {
    heading: 'SUBSCRIBE TO OUR NEWSLETTER',
    description: 'Unlock savings & perks, members-only offers.',
    emailPlaceholder: 'Email address',
    buttonLabel: 'Subscribe',
  },
  contact: {
    address: '5425 Janet Ct, OAK FOREST, IL 60452-3740, United States',
    phone: '+86 1234567 8910',
    salesEmail: 'sales@ecolitea.com',
  },
  copyrightText: '© 2026 Ecolitea. All rights reserved.',
  legalLinks: ['Privacy Policy', 'Terms'],
}

const icons = {
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  phone:
    '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
}
const lucide = (d) =>
  `<svg class="contactIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

/* ---------------------------------------------------------------- markup */

const footerMarkup = () => `
<footer class="footer" data-website-theme="inverse">
  <div class="site-container">
    <div class="primaryGrid">
      <section class="brand" aria-label="Brand">
        <a class="brandLink" href="#"><span class="logo" style="--logo-url:url('${logo}')"></span></a>
        <p class="description">${content.siteDescription}</p>
        <ul class="socialList" aria-label="Social media">
          ${socials
            .map(
              (s) =>
                `<li><a class="socialLink" href="#" aria-label="${s.name}"><img class="socialIcon" alt="" src="${s.uri}" width="20" height="20"></a></li>`,
            )
            .join('')}
        </ul>
      </section>

      <nav class="navigation" data-enhanced="true" aria-label="Footer">
        ${content.columns
          .map(
            (c, i) => `
        <div class="column">
          <button class="accordionTrigger" type="button" aria-expanded="${i === 0}">
            ${c.label}<span class="accordionIcon" aria-hidden="true">+</span>
          </button>
          <span class="desktopHeading">${c.label}</span>
          <div class="linkPanel" data-open="${i === 0}">
            <ul class="linkList">
              ${c.items.map((l) => `<li><a class="navLink" href="#">${l}</a></li>`).join('')}
            </ul>
          </div>
        </div>`,
          )
          .join('')}
      </nav>

      <div class="engagement">
        <section class="newsletter" aria-label="Newsletter">
          <h2 class="newsletterHeading">${content.newsletter.heading}</h2>
          <p class="newsletterDescription">${content.newsletter.description}</p>
          <div class="newsletterControls">
            <input class="newsletterInput" type="email" disabled placeholder="${content.newsletter.emailPlaceholder}">
            <button class="newsletterButton" type="button" disabled>${content.newsletter.buttonLabel}</button>
          </div>
        </section>
        <address class="information">
          <ul class="contactList">
            <li class="contactItem">${lucide(icons.pin)}<span>${content.contact.address}</span></li>
            <li class="contactItem">${lucide(icons.phone)}<a href="#">${content.contact.phone}</a></li>
            <li class="contactItem">${lucide(icons.mail)}<a href="#">${content.contact.salesEmail}</a></li>
          </ul>
        </address>
      </div>
    </div>

    <div class="bottomBar">
      <p>${content.copyrightText}</p>
      <nav aria-label="Legal">
        <ul class="legalList">
          ${content.legalLinks.map((l) => `<li><a href="#">${l}</a></li>`).join('')}
        </ul>
      </nav>
    </div>
  </div>
</footer>`

const stages = [
  { w: 1300, label: '桌面 1300px', note: '常规桌面' },
  { w: 1170, label: '桌面 1170px', note: '断点边缘 — 品牌列最窄，社交图标最容易换行' },
  { w: 390, label: '移动 390px', note: 'iPhone 14 / 15' },
  { w: 320, label: '移动 320px', note: 'iPhone SE — 订阅控件左右布局的最窄考验' },
]

/* ------------------------------------------------------------------ page */

const css = String.raw`
@font-face { font-family:'Geist'; src:url(data:font/woff2;base64,${font}) format('woff2'); font-weight:100 900; font-display:block; }

/* ---- tokens, verbatim from src/styles/tokens.css ---- */
:root {
  --website-font-sans:'Geist',system-ui,sans-serif;
  --website-font-mono:ui-monospace,monospace;
  --website-container-site:76.25rem;
  --website-color-brand-black:#0a0a0a;
  --website-color-brand-white:#ffffff;
  --website-space-1:4px;  --website-space-2:8px;  --website-space-3:12px;
  --website-space-4:16px; --website-space-6:24px; --website-space-8:32px;
  --website-space-12:48px; --website-space-16:64px;
  --website-radius-control:8px;
  --website-control-compact:40px; --website-control-default:48px; --website-control-target-min:44px;
  --website-icon-small:16px; --website-icon-medium:20px; --website-icon-large:24px;
  --website-duration-fast:160ms; --website-duration-standard:240ms;
  --website-easing-standard:cubic-bezier(0.2,0.8,0.2,1);
  --website-gutter:16px;
}
[data-website-theme='inverse'] {
  --website-color-background:var(--website-color-brand-black);
  --website-color-foreground:var(--website-color-brand-white);
  --website-color-muted-foreground:rgb(255 255 255 / 68%);
  --website-color-subtle-foreground:rgb(255 255 255 / 48%);
  --website-color-muted-surface:rgb(255 255 255 / 6%);
  --website-color-interactive-surface:rgb(255 255 255 / 8%);
  --website-color-border:rgb(255 255 255 / 18%);
  --website-color-input:rgb(255 255 255 / 24%);
  --website-color-action:var(--website-color-brand-white);
  --website-color-action-foreground:var(--website-color-brand-black);
  --website-color-disabled-surface:rgb(255 255 255 / 8%);
  --website-color-disabled-foreground:rgb(255 255 255 / 48%);
}

/* ---- reset + review chrome ---- */
*,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}
ul,ol{list-style:none} a{color:inherit;text-decoration:none} img,svg{display:block}
button,input{font:inherit;letter-spacing:inherit;color:inherit;background:transparent;border-radius:0;opacity:1;appearance:none}
body{font-family:var(--website-font-sans);background:#f4f4f5;color:#262629;padding:32px 32px 120px}
h1{font-size:24px;font-weight:700;letter-spacing:-0.5px}
.intro{font-size:14px;line-height:1.6;color:#52525b;margin-top:8px;max-width:66rem}
.intro code{font-family:ui-monospace,monospace;font-size:12px;background:#e8e8ea;padding:1px 5px;border-radius:4px}
.stageLabel{display:flex;align-items:baseline;gap:10px;margin:34px 0 10px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.stageLabel span{font-weight:400;letter-spacing:0;text-transform:none;color:#71717a}
.stage{background:#0a0a0a;container-type:inline-size;outline:1px solid #d4d4d8}
.probe{margin-top:10px;font-family:ui-monospace,monospace;font-size:12px;color:#3f3f46;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:10px 12px;white-space:pre-wrap}

/* ---- site container, from src/styles/layout.css ---- */
.site-container{width:min(100% - (2 * var(--website-gutter)),var(--website-container-site));margin-inline:auto}
@container (width >= 40rem){.site-container{--website-gutter:24px}}
@container (width >= 48rem){.site-container{--website-gutter:32px}}
@container (width >= 73.125rem){.site-container{--website-gutter:clamp(40px,4vw,48px)}}

/* =====================================================================
   Below is src/Footer/index.module.css, read from disk at build time.
   ===================================================================== */
${footerCss}
`

const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Footer — 应用后的真实样式</title><style>${css}</style></head>
<body>
<h1>Footer — 应用后的真实样式</h1>
<p class="intro">
  本页的 Footer 样式表<strong>直接读自</strong> <code>src/Footer/index.module.css</code>，
  <code>composes</code> 已对照 <code>src/styles/typography.css</code> 展开，视口媒体查询改写为容器查询以便每个尺寸渲染各自的响应式状态。
  内容为本地开发库 <code>ecolitea2</code> 真实快照，字体为项目自带 Geist Variable，1:1 像素未缩放。手风琴可点。
</p>
${stages
  .map(
    (s) => `
<div class="stageLabel">${s.label} <span>${s.note}</span></div>
<div class="stage" data-w="${s.w}" style="width:${s.w}px">${footerMarkup()}</div>
<div class="probe" data-probe-for="${s.w}">measuring…</div>`,
  )
  .join('')}

<script>
  for (const t of document.querySelectorAll('.accordionTrigger')) {
    t.addEventListener('click', () => {
      const open = t.getAttribute('aria-expanded') !== 'true'
      t.setAttribute('aria-expanded', String(open))
      t.parentElement.querySelector('.linkPanel').dataset.open = String(open)
    })
  }
  const r = (el) => el.getBoundingClientRect()
  for (const stage of document.querySelectorAll('.stage')) {
    const probe = document.querySelector('[data-probe-for="' + stage.dataset.w + '"]')
    const list = stage.querySelector('.socialList')
    const links = [...stage.querySelectorAll('.socialLink')]
    const rows = new Set(links.map((l) => Math.round(r(l).top)))
    const input = stage.querySelector('.newsletterInput')
    const btn = stage.querySelector('.newsletterButton')
    const sameRow = Math.round(r(input).top) === Math.round(r(btn).top)
    probe.textContent = [
      'brand column  ' + Math.round(r(stage.querySelector('.brand')).width) + 'px',
      'social row    ' + Math.round(r(list).width) + 'px wide, ' + rows.size + ' 行' + (rows.size > 1 ? '  ⚠ 换行' : '  ✓'),
      'newsletter    input ' + Math.round(r(input).width) + 'px + button ' + Math.round(r(btn).width) + 'px  ' + (sameRow ? '左右并排 ✓' : '上下堆叠 ⚠'),
      'footer height ' + Math.round(r(stage.querySelector('.footer')).height) + 'px',
    ].join('\\n')
  }
</script>
</body></html>`

writeFileSync(join(here, 'index.html'), html)
console.log('wrote index.html', html.length, 'bytes')
