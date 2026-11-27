import type { Product } from '@/payload-types'

/** Post-20261109/20261110/20261111 persisted fields, checked against the current schema. */
export function currentProductMigrationFixture() {
  return {
    summary: 'Current summary',
    resources: ['document-id'],
    specifications: [
      { id: 'group', group: 'Power', items: [{ id: 'spec', label: 'Voltage', value: '240 V' }] },
    ],
    sections: [
      {
        id: 'section',
        label: 'Details',
        theme: 'inverse',
        title: 'Current section title',
        blocks: [
          {
            blockType: 'productMediaBanner',
            body: 'Current body',
            media: 'media-id',
            playback: 'ambient',
            aspectRatio: '16:9',
          },
          {
            blockType: 'productMediaCarousel',
            slides: [{ media: 'media-id', playback: 'ambient' }],
            aspectRatio: '21:9',
          },
          {
            blockType: 'productMediaTabs',
            tabs: [
              { title: 'First', media: 'media-id', playback: 'ambient' },
              { title: 'Second', media: 'media-id', playback: 'player' },
            ],
            aspectRatio: '4:3',
          },
          {
            blockType: 'productMediaAccordion',
            items: [
              { title: 'First', media: 'media-id', playback: 'ambient' },
              { title: 'Second', media: 'media-id', playback: 'player' },
            ],
            aspectRatio: '4:5',
            mediaPosition: 'right',
          },
          {
            blockType: 'productMediaText',
            title: 'Text',
            media: 'media-id',
            playback: 'ambient',
            mediaPosition: 'left',
            aspectRatio: '4:3',
          },
          {
            blockType: 'productCode',
            label: 'Code',
            html: '<p>Keep</p>',
            minHeight: 240,
            width: 'standard',
          },
        ],
      },
    ],
  } satisfies Pick<Product, 'summary' | 'resources' | 'specifications' | 'sections'>
}
