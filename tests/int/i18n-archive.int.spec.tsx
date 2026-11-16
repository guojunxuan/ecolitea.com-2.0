import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
const find = vi.hoisted(() => vi.fn(async () => ({ docs: [{ id: 'p', title: 'English' }] })))
vi.mock('payload', () => ({ getPayload: async () => ({ find }) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/components/RichText', () => ({ default: () => null }))
vi.mock('@/components/CollectionArchive', () => ({
  CollectionArchive: ({ posts }: { posts: { title: string }[] }) => (
    <output>{posts[0]?.title}</output>
  ),
}))
vi.mock('@/utilities/i18n/getLocalized', () => ({
  readyTranslationFilter: async () => [{ id: { in: ['p'] } }],
  getLocalizedList: async (docs: object[]) => docs.map((doc) => ({ ...doc, title: 'Deutsch' })),
}))
import { ArchiveBlock } from '@/collections/Pages/blocks/Archive/Component'
describe('localized collection-populated Page archives', () => {
  it('uses public ready Posts before the display limit and merges their copy', async () => {
    const content = await ArchiveBlock({
      blockType: 'pageArchive',
      populateBy: 'collection',
      locale: 'de',
      limit: 3,
    })
    expect(renderToStaticMarkup(content)).toContain('Deutsch')
    expect(find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        draft: false,
        overrideAccess: false,
        limit: 3,
        where: { and: [{ id: { in: ['p'] } }] },
      }),
    )
  })
})
