import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { config, routeLocale } from '@/proxy'
const fixture = [
  { code: 'en', label: 'English', status: 'source' as const },
  { code: 'de', label: 'Deutsch', status: 'live' as const },
  { code: 'fr', label: 'Français', status: 'translating' as const },
]
describe('locale routing', () => {
  it('rewrites unprefixed English while preserving the query', () => {
    const response = routeLocale(new NextRequest('http://localhost/products?q=a'), fixture)
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost/en/products?q=a')
  })
  it('passes public languages and rejects unavailable language segments', () => {
    expect(routeLocale(new NextRequest('http://localhost/de/products'), fixture).headers.get('x-middleware-next')).toBe('1')
    for (const path of ['/fr', '/xx/a', '/zh-tw']) expect(routeLocale(new NextRequest(`http://localhost${path}`), fixture).status).toBe(404)
  })
  it('excludes infrastructure and public assets without excluding content', () => {
    for (const url of ['/api/pages', '/admin', '/next/preview', '/_next/static/a', '/fonts/a', '/media/a', '/brand-assets/a', '/block-previews/a', '/demos/a', '/robots.txt', '/pages-sitemap.xml']) {
      expect(new RegExp(`^${config.matcher[0]}$`).test(url)).toBe(false)
    }
    for (const url of ['/', '/apiary', '/search', '/products']) expect(new RegExp(`^${config.matcher[0]}$`).test(url)).toBe(true)
  })
})
