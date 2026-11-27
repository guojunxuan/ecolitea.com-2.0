import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { findMediaReferences } from '@/collections/mediaReferences'
import { findDocumentReferences } from '@/collections/Documents/references'

const page = (docs: unknown[]) => ({
  docs,
  totalDocs: docs.length,
  totalPages: 1,
  page: 1,
  hasNextPage: false,
  nextPage: null,
})

describe('Product section block references', () => {
  it('discovers nested block media, Code assets and document links without database access', async () => {
    const payload = {
      config: {
        routes: { admin: '/admin' },
        collections: [{ slug: 'products', admin: { useAsTitle: 'title' }, versions: false }],
        globals: [],
      },
      find: vi.fn(async () =>
        page([
          {
            id: 'product',
            title: 'Tea equipment',
            sections: [
              {
                blocks: [
                  { blockType: 'productMediaBanner', media: 'image', mobileMedia: 'image' },
                  { blockType: 'productMediaCarousel', slides: [{ media: 'image' }] },
                  { blockType: 'productMediaTabs', tabs: [{ media: 'image' }] },
                  {
                    blockType: 'productMediaAccordion',
                    items: [
                      {
                        media: 'image',
                        body: {
                          root: {
                            children: [
                              {
                                type: 'link',
                                fields: { doc: { relationTo: 'documents', value: 'document' } },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                  { blockType: 'productMediaText', media: 'image' },
                  { blockType: 'productCode', assets: ['image'] },
                ],
              },
            ],
          },
        ]),
      ),
    }
    const media = await findMediaReferences(payload as unknown as Payload, ['image'])
    expect(media.map(({ path }) => path)).toEqual([
      'sections[0].blocks[0].media',
      'sections[0].blocks[0].mobileMedia',
      'sections[0].blocks[1].slides[0].media',
      'sections[0].blocks[2].tabs[0].media',
      'sections[0].blocks[3].items[0].media',
      'sections[0].blocks[4].media',
      'sections[0].blocks[5].assets[0]',
    ])
    const documents = await findDocumentReferences(payload as unknown as Payload, ['document'])
    expect(documents).toContainEqual(
      expect.objectContaining({
        ownerSlug: 'products',
        path: 'sections[0].blocks[3].items[0].body.root.children[0].fields.doc.value',
      }),
    )
  })
})
