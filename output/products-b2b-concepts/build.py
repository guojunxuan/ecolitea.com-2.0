from pathlib import Path
import html
import shutil

root = Path('/Users/jason/ecolitea.com 2.0')
out = root / 'public/demos/products-b2b-concepts-20261104'
for name in ['tokens', 'typography', 'layout']:
    shutil.copy2(root / f'src/styles/{name}.css', out / f'{name}.css')
for name in ['Regular', 'SemiBold', 'Bold']:
    shutil.copy2(root / f'node_modules/geist/dist/fonts/geist-sans/Geist-{name}.woff2', out / f'Geist-{name}.woff2')

origin = 'https://media-dev.ecolitea.com/cdn-cgi/image/'
products = [
    ('Insta360 X6', '全景影像设备', 'header-insta360-x6.png', 'demo-insta360-x6'),
    ('Insta360 GO Ultra', '便携影像设备', 'header-insta360-go-ultra.png', 'demo-insta360-go-ultra'),
    ('Insta360 Ace Pro 2', '运动影像设备', 'header-insta360-ace-pro-2.png', 'demo-insta360-ace-pro-2'),
    ('Insta360 X4 Air', '全景影像设备', 'header-insta360-x4-air.jpg', 'demo-insta360-x4-air'),
    ('Insta360 Flow 2 Series', '影像配件系列', 'header-insta360-flow-2-pro.png', 'demo-insta360-flow-2-series'),
]
scene = origin + 'width=3840,fit=cover,quality=85,format=auto/media/header-interest-8.jpg?2026-10-18T11%3A27%3A34.700Z'
band = origin + 'width=3840,fit=cover,quality=85,format=auto/media/header-insta360-x6.png?2026-10-18T11%3A27%3A27.642Z'
category = '/products/demo-imaging-equipment'

def image(product, cls=''):
    return f'<img class="{cls}" src="{html.escape(origin + "width=3840,height=3840,fit=contain,quality=85,format=auto/media/" + product[2])}" alt="{html.escape(product[0])}" loading="eager">'

arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>'

def action(text, href=category, cls='text-link'):
    return f'<a class="{cls}" href="{href}" target="_blank" rel="noopener">{text}{arrow}</a>'

def card(product):
    href = category + '/' + product[3]
    return f'<article class="product-card"><a class="product-cover" href="{href}" target="_blank" rel="noopener">{image(product)}</a><div class="product-copy"><h2><a href="{href}" target="_blank" rel="noopener">{product[0]}</a></h2><p>{product[1]}</p>{action("产品详情", href)}</div></article>'

nav = '''<nav class="category-nav" aria-label="分类定位"><div class="container"><a class="active" href="#imaging">影像设备</a><a href="#outdoor">户外探索</a><a href="/products/demo-creator" target="_blank" rel="noopener">创作影像</a><a href="/products/demo-professional" target="_blank" rel="noopener">专业设备</a></div></nav>'''
footer = '<footer class="draft-footer container">布局草稿 · 使用当前站点的示例产品素材，产品文案仅作排版演示。</footer>'

def document(title, body, cls):
    return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{title}</title><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="typography.css"><link rel="stylesheet" href="layout.css"><link rel="stylesheet" href="concepts.css"></head><body class="{cls}">{nav}<main>{body}</main>{footer}</body></html>'

catalog = f'''<section id="imaging" class="catalog-section"><div class="container"><header class="section-head"><div><h1>影像设备</h1><p>浏览产品系列，找到适合业务需求的设备。</p></div>{action('查看全部 10 款', cls='outline-link')}</header><div class="catalog-grid">{''.join(card(p) for p in products)}<a class="range-link" href="{category}" target="_blank" rel="noopener"><span>更多影像设备</span><strong>查看完整系列{arrow}</strong><small>全部 10 款产品</small></a></div></div></section><section id="outdoor" class="next-category container"><header class="section-head"><div><h2>户外探索</h2><p>按使用场景了解其他产品系列。</p></div>{action('查看系列', '/products/demo-outdoor')}</header><a class="quiet-band" href="/products/demo-outdoor" target="_blank" rel="noopener"><img src="{html.escape(scene)}" alt="户外探索系列示例"><div><h3>面向户外应用的设备系列</h3><span>产品与规格{arrow}</span></div></a></section>'''
(out / 'a-catalog.html').write_text(document('A · 系列目录', catalog, 'catalog'), encoding='utf-8')

showcase = f'''<section id="imaging" class="showcase-section container"><div class="showcase-intro"><div class="intro-copy"><h1>影像设备</h1><p>从产品用途出发，<br>探索适合你的影像设备。</p><p class="intro-detail">先了解系列，再查看具体型号与规格。<br>让产品画面和应用场景一起说明选择。</p>{action('浏览完整系列', cls='solid-link')}</div><article class="featured-product"><a class="featured-cover" href="{category}/{products[0][3]}" target="_blank" rel="noopener"><img src="{html.escape(band)}" alt="Insta360 X6 示例产品"></a><div class="featured-caption"><div><h2>Insta360 X6</h2><p>全景影像设备</p></div>{action('产品详情', category + '/' + products[0][3])}</div></article></div><div class="showcase-grid">{''.join(card(p) for p in products[1:4])}</div></section><section id="outdoor" class="application-section"><div class="container application-grid"><img src="{html.escape(scene)}" alt="户外探索应用场景"><div><h2>户外探索</h2><p>从应用场景到产品系列，<br>逐步了解适合业务的设备。</p>{action('探索该系列', '/products/demo-outdoor', 'outline-link')}</div></div></section>'''
(out / 'b-showcase.html').write_text(document('B · 应用与产品', showcase, 'showcase'), encoding='utf-8')

def row(product):
    href=category+'/'+product[3]
    return f'<article class="selection-row"><a class="selection-product" href="{href}" target="_blank" rel="noopener">{image(product)}<div><h2>{product[0]}</h2><span>{product[1]}</span></div></a><p class="selection-description">查看产品介绍、可选配置与详细规格，了解该型号。</p><div class="selection-actions">{action("查看规格", href+"#specifications")}{action("产品详情", href, "subtle-link")}</div></article>'

selection = f'''<div class="container selection-layout"><aside class="series-index"><h2>产品系列</h2><a class="selected" href="#imaging">影像设备 <span>10</span></a><a href="#outdoor">户外探索</a><a href="/products/demo-creator" target="_blank" rel="noopener">创作影像</a><a href="/products/demo-professional" target="_blank" rel="noopener">专业设备</a></aside><div class="selection-content"><section id="imaging"><header class="section-head"><div><h1>影像设备</h1><p>集中查看产品型号，快速进入详情与规格。</p></div>{action('全部 10 款')}</header><div class="selection-table"><div class="table-head"><span>产品型号</span><span>产品概述</span><span>详情与规格</span></div>{''.join(row(p) for p in products)}</div><div class="table-end">当前展示 5 款型号{action('查看全部产品')}</div></section><section id="outdoor" class="selection-next"><h2>户外探索</h2><p>按产品系列继续浏览。</p>{action('浏览该系列', '/products/demo-outdoor', 'outline-link')}</section></div></div>'''
(out / 'c-selection.html').write_text(document('C · 选型目录', selection, 'selection'), encoding='utf-8')
print('Three design concepts generated:',out)
