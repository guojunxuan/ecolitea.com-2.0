from pathlib import Path
import xml.etree.ElementTree as ET

root = Path('/Users/jason/ecolitea.com 2.0')
folder = root / 'public/demos/products-b2b-concepts-20261104'
catalog = ET.fromstring((folder / 'a-catalog.html').read_text().partition('\n')[2])
showcase = ET.fromstring((folder / 'b-showcase.html').read_text().partition('\n')[2])

def markup(element):
    return ET.tostring(element, encoding='unicode', method='html')

header = markup(catalog.find('.//header[@class="section-head"]'))
cards = catalog.findall('.//div[@class="catalog-grid"]/article')[1:]
image_link = markup(showcase.find('.//a[@class="featured-cover"]'))
detail = '/products/demo-imaging-equipment/demo-insta360-x6'
arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>'
body = f'''<section id="imaging" class="hybrid-section"><div class="container">{header}
<article class="hybrid-feature">{image_link}<div class="hybrid-feature-copy"><div><h2>Insta360 X6</h2><p class="hybrid-product-type">全景影像设备</p><p class="hybrid-description">了解这一型号的产品介绍与规格，<br>浏览同系列的其他设备。</p></div><div class="hybrid-actions"><a class="solid-link" href="{detail}" target="_blank" rel="noopener">查看产品{arrow}</a><a class="text-link" href="{detail}#specifications" target="_blank" rel="noopener">规格参数{arrow}</a></div></div></article>
<div class="hybrid-products">{''.join(markup(card) for card in cards)}</div>
<div class="hybrid-range-end"><p>浏览更多同系列设备</p><a class="text-link" href="/products/demo-imaging-equipment" target="_blank" rel="noopener">查看全部 10 款{arrow}</a></div>
</div></section>{markup(catalog.find('.//section[@id="outdoor"]'))}'''
document = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AB · 系列目录与重点产品</title><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="typography.css"><link rel="stylesheet" href="layout.css"><link rel="stylesheet" href="concepts.css"><link rel="stylesheet" href="hybrid.css"></head><body class="hybrid">{markup(catalog.find('.//nav'))}<main>{body}</main>{markup(catalog.find('.//footer'))}</body></html>'''
(folder / 'ab-hybrid.html').write_text(document, encoding='utf-8')
print('AB hybrid draft generated without rewriting the original A/B/C pages.')
