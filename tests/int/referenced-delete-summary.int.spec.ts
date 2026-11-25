import { beforeEach, describe, expect, it, vi } from 'vitest'

const scanners = vi.hoisted(() => ({ media: vi.fn(), documents: vi.fn() }))
vi.mock('@/collections/mediaReferences', () => ({
  findMediaReferences: scanners.media,
  mediaOwnerLabel: () => 'Blogs',
}))
vi.mock('@/collections/Documents/references', () => ({
  findDocumentReferences: scanners.documents,
  documentOwnerLabel: () => 'Blogs',
}))
import { preventReferencedDelete as mediaDelete } from '@/collections/mediaHooks/preventReferencedDelete'
import { preventReferencedDelete as documentDelete } from '@/collections/Documents/hooks/preventReferencedDelete'

for (const [name, hook, scan, idField] of [
  ['Media', mediaDelete, scanners.media, 'documentID'],
  ['Documents', documentDelete, scanners.documents, 'ownerDocumentID'],
] as const) {
  describe(`${name} deletion summary`, () => {
    const req = {
      payload: {
        config: {
          collections: [{ slug: 'blogs', labels: { singular: { zh: '博客', en: 'Blog' } } }],
          globals: [{ slug: 'header', label: { zh: '页眉', en: 'Header' } }],
        },
      },
    }
    const reference = (id: string, extra = {}) => ({
      ownerType: 'collection',
      ownerSlug: 'blogs',
      [idField]: id,
      kind: 'current',
      title: `Title ${id}`,
      path: 'secret.path',
      ...extra,
    })
    const run = () => hook({ id: 'asset', req } as never)
    beforeEach(() => scan.mockReset())
    it('uses configured singular labels and deduplicates field paths', async () => {
      scan.mockResolvedValue([
        reference('A'),
        reference('A', { path: 'other.path' }),
        reference('global', { ownerType: 'global', ownerSlug: 'header' }),
      ])
      await expect(run()).rejects.toThrow(
        'Can\'t delete: used in Blog "Title A" and Header. Remove it there first.',
      )
    })
    it('shows three unique owners and counts remaining owners, not paths', async () => {
      scan.mockResolvedValue(['A', 'A', 'B', 'C', 'D', 'E', 'E'].map((id) => reference(id)))
      await expect(run()).rejects.toThrow(
        'Can\'t delete: used in Blog "Title A", Blog "Title B" and Blog "Title C" … and 2 more. Remove it there first.',
      )
    })
    it('retains distinct IDs with the same title and falls back to another localized label', async () => {
      const localizedReq = {
        payload: {
          config: {
            collections: [{ slug: 'blogs', labels: { singular: { fr: 'Article' } } }],
            globals: [],
          },
        },
      }
      scan.mockResolvedValue([reference('A'), reference('B', { title: 'Title A' })])
      await expect(hook({ id: 'asset', req: localizedReq } as never)).rejects.toThrow(
        'Can\'t delete: used in Article "Title A" and Article "Title A". Remove it there first.',
      )
    })
    it('renders a single owner without paths or a conjunction', async () => {
      scan.mockResolvedValue([reference('A')])
      await expect(run()).rejects.toThrow(
        'Can\'t delete: used in Blog "Title A". Remove it there first.',
      )
    })
    it('keeps owners distinct across collection slugs and owner types', async () => {
      scan.mockResolvedValue([
        reference('A'),
        reference('A', { ownerSlug: 'news' }),
        reference('A', { ownerType: 'global', ownerSlug: 'blogs' }),
      ])
      await expect(run()).rejects.toThrow(
        'Can\'t delete: used in Blog "Title A", news "Title A" and blogs. Remove it there first.',
      )
    })
    it('ignores historical references', async () => {
      scan.mockResolvedValue([reference('A', { kind: 'version' })])
      await expect(run()).resolves.toBeUndefined()
    })
  })
}

describe('Site Assets deletion guard', () => {
  it('scans references for Site Assets, skipping only its own collection', async () => {
    const { SiteAssets } = await import('@/collections/SiteAssets')
    const [hook] = SiteAssets.hooks?.beforeDelete ?? []
    const req = {
      payload: {
        config: { collections: [], globals: [{ slug: 'site-settings', label: 'Site Settings' }] },
      },
    }
    scanners.media.mockReset()
    scanners.media.mockResolvedValue([
      {
        ownerType: 'global',
        ownerSlug: 'site-settings',
        kind: 'current',
        title: 'Site',
        path: 'logo',
      },
    ])
    await expect(hook({ id: 'logo-asset', req } as never)).rejects.toThrow(
      "Can't delete: used in Site Settings. Remove it there first.",
    )
    expect(scanners.media).toHaveBeenCalledWith(req.payload, ['logo-asset'], req, 'site-assets')
    scanners.media.mockResolvedValue([])
    await expect(hook({ id: 'unused', req } as never)).resolves.toBeUndefined()
  })
})
