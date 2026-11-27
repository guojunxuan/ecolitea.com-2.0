import { describe, expect, it } from 'vitest'
import { internalLocalePaths } from '@/utilities/i18n/revalidatePaths'
describe('internal rewritten path invalidation', () => {
  const fixture = [
    { code: 'en', label: 'English', status: 'source' as const },
    { code: 'de', label: 'Deutsch', status: 'live' as const },
    { code: 'fr', label: 'Français', status: 'translating' as const },
  ]
  it('expands public paths to English/internal and all live languages', () => {
    expect(internalLocalePaths('/', fixture)).toEqual(['/en', '/de'])
    expect(internalLocalePaths('/products/[category]', fixture)).toEqual([
      '/[lang]/products/[category]',
    ])
  })
  it('preserves already partitioned paths and infrastructure routes', () => {
    expect(internalLocalePaths('/en/products/[category]', fixture)).toEqual([
      '/[lang]/products/[category]',
    ])
    expect(internalLocalePaths('/en/products', fixture)).toEqual(['/en/products'])
    expect(internalLocalePaths('/de/products', fixture)).toEqual(['/de/products'])
    expect(internalLocalePaths('/pages-sitemap.xml', fixture)).toEqual(['/pages-sitemap.xml'])
  })
})
