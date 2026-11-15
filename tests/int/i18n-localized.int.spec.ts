import { describe, expect, it, vi } from 'vitest'
vi.mock('@/plugins/translation/read', () => ({ mergeTranslation: vi.fn(async (doc, { locale }) => locale === 'de' ? { ...doc, title: 'Deutsch' } : null) }))
import { getLocalizedDoc, localizePopulated, localizedCacheKey } from '@/utilities/i18n/getLocalized'
describe('localized public read boundary', () => {
  it('partitions cache identity and leaves English unchanged', async () => {
    const doc = { id: 'a', title: 'English', _status: 'published' }
    expect(await getLocalizedDoc(doc, 'pages', 'en')).toBe(doc)
    expect(localizedCacheKey('pages', 'a', 'en')).not.toEqual(localizedCacheKey('pages', 'a', 'de'))
  })
  it('requires a public source and a retained ready translation', async () => {
    const payload = { config: { collections: [] } } as never
    expect(await getLocalizedDoc({ id: 'a', _status: 'draft' }, 'pages', 'de', payload)).toBeNull()
    expect(await getLocalizedDoc({ id: 'a', _status: 'published', publishedAt: '2999-01-01' }, 'blogs', 'de', payload)).toBeNull()
    expect(await getLocalizedDoc({ id: 'a' }, 'pages', 'fr', payload)).toBeNull()
    expect(await getLocalizedDoc({ id: 'a' }, 'pages', 'de', payload)).toMatchObject({ title: 'Deutsch' })
  })
  it('batch-merges populated media alt before presentation normalization', async () => {
    const find = vi.fn(async () => ({ docs: [{ sourceCollection: 'media', sourceId: 'm', lastReadySourceVersion: 'v1', fields: { alt: 'Bild' } }] }))
    const payload = { find, config: { collections: [{ slug: 'pages', fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] }, { slug: 'media', fields: [] }] } } as never
    const source = { id: 'p', image: { id: 'm', alt: 'Image', url: '/original.png' } }
    expect(await localizePopulated(source, 'pages', 'de', payload)).toEqual({ id: 'p', image: { id: 'm', alt: 'Bild', url: '/original.png' } })
    expect(source.image.alt).toBe('Image')
    expect(find).toHaveBeenCalledTimes(1)
  })

})
