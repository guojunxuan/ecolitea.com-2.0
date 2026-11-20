import { expect, it } from 'vitest'
import configPromise from '@payload-config'

const groups = {
  Products: ['products', 'product-categories', 'quote-requests'],
  Content: ['pages', 'blogs', 'blog-categories', 'case-studies', 'forms', 'form-submissions'],
  Assets: ['media', 'documents', 'site-assets', 'folders'],
  Site: ['header', 'footer', 'site-settings', 'settings', 'redirects', 'search', 'users'],
}

it('groups all visible Admin entities into their business sections', async () => {
  const { collections, globals } = await configPromise
  const entities = [...collections, ...globals]
  expect(entities.map(({ slug }) => slug)).not.toContain('posts')
  expect(entities.map(({ slug }) => slug)).not.toContain('categories')
  for (const [group, slugs] of Object.entries(groups)) {
    for (const slug of slugs) {
      const entity = entities.find((item) => item.slug === slug)
      expect(entity?.admin?.group, slug).toBe(group)
      expect(entity?.admin?.hidden, slug).not.toBe(true)
    }
  }
  for (const slug of ['social-platforms', 'translations', 'translation-usage', 'translation-search']) {
    expect(entities.find((item) => item.slug === slug)?.admin?.hidden, slug).toBe(true)
  }
})

it('orders native collection groups and editable globals consistently', async () => {
  const { collections, globals } = await configPromise
  const nativeSlugs = [...groups.Products, ...groups.Content.slice(0, 4), ...groups.Assets, 'users']
  expect(collections.map(({ slug }) => slug).filter((slug) => nativeSlugs.includes(slug))).toEqual(nativeSlugs)
  expect(globals.map(({ slug }) => slug).filter((slug) => groups.Site.includes(slug))).toEqual(groups.Site.slice(0, 4))
})
