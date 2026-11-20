import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const find = vi.hoisted(() => vi.fn(async () => ({ docs: [{ id: 'b', title: 'English' }] })))
vi.mock('payload', () => ({ getPayload: async () => ({ find }) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/components/RichText', () => ({ default: () => null }))
vi.mock('@/components/CollectionArchive', () => ({
  CollectionArchive: ({ posts, relationTo }: { posts: { title: string }[]; relationTo: string }) => (
    <output data-collection={relationTo}>{posts.map(({ title }) => title).join(', ')}</output>
  ),
}))
vi.mock('@/utilities/i18n/getLocalized', () => ({
  readyTranslationFilter: async () => [{ id: { in: ['b'] } }],
  getLocalizedList: async (docs: object[], _collection: string, locale: string) =>
    locale === 'en' ? docs : docs.map((doc) => ({ ...doc, title: 'Deutsch' })),
}))

import { ArchiveBlock } from '@/collections/Pages/blocks/Archive/Component'

describe('Page blog archives', () => {
  beforeEach(() => find.mockClear())

  it('filters public blogs by category and applies the ready translation filter before the limit', async () => {
    const content = await ArchiveBlock({
      blockType: 'pageArchive',
      populateBy: 'collection',
      categories: ['green', { id: 'black', title: 'Black Tea' } as never],
      locale: 'de',
      limit: 3,
    })
    const markup = renderToStaticMarkup(content)
    expect(markup).toContain('data-collection="blogs"')
    expect(markup).toContain('Deutsch')
    expect(find).toHaveBeenLastCalledWith(expect.objectContaining({
      collection: 'blogs',
      draft: false,
      overrideAccess: false,
      limit: 3,
      where: { and: expect.arrayContaining([
        { _status: { equals: 'published' }, publishedAt: { less_than_equal: expect.any(String) } },
        { id: { in: ['b'] } },
        { category: { in: ['green', 'black'] } },
      ]) },
    }))
  })

  it('renders populated selections in order while skipping unresolved, draft and future blogs', async () => {
    const entry = (title: string, _status = 'published', publishedAt = '2026-01-01T00:00:00Z') =>
      ({ relationTo: 'blogs', value: { title, _status, publishedAt } })
    const content = await ArchiveBlock({
      blockType: 'pageArchive',
      populateBy: 'selection',
      selectedDocs: [
        entry('First'),
        { relationTo: 'blogs', value: 'unresolved' },
        entry('Draft', 'draft'),
        entry('Future', 'published', '2099-01-01T00:00:00Z'),
        entry('Second'),
      ] as never,
    })
    expect(renderToStaticMarkup(content)).toContain('>First, Second</output>')
    expect(find).not.toHaveBeenCalled()
  })
})
