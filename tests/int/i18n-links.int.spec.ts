import { describe, expect, it } from 'vitest'
import { localePath, stripLocale } from '@/i18n/paths'
import { getContentPath } from '@/utilities/getContentPath'
import { resolveLinkHref } from '@/utilities/resolveLinkHref'
describe('public locale URLs', () => {
  it('preserves existing English and external links', () => {
    expect(localePath('/products?q=tea', 'en')).toBe('/products?q=tea')
    expect(localePath('https://example.invalid/x', 'de')).toBe('https://example.invalid/x')
    expect(localePath('#details', 'de')).toBe('#details')
    for (const path of [
      '/catalog.pdf',
      '/media/download',
      '/fonts/a',
      '/brand-assets/logo',
      '/block-previews/a',
      '/demos/a',
    ])
      expect(localePath(path, 'de')).toBe(path)
  })
  it('prefixes internal links once and shares English slugs', () => {
    expect(localePath('/blogs/tea', 'de')).toBe('/de/blogs/tea')
    expect(localePath('/de/blogs/tea', 'de')).toBe('/de/blogs/tea')
    expect(stripLocale('/de')).toBe('/')
    expect(getContentPath('pages', 'about', { locale: 'de' })).toBe('/de/about')
    expect(resolveLinkHref({ type: 'custom', url: '/products' }, 'de')).toBe('/de/products')
  })
})
