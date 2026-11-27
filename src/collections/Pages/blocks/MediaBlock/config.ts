import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'
import { mediaAspectRatioOptions } from '@/components/Media/aspectRatio'

export const MediaBlock: Block = {
  slug: 'pageMediaBlock',
  interfaceName: 'PageMediaBlock',
  labels: { singular: 'Media', plural: 'Media' },
  admin: {
    group: 'Pages',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media' },
      },
    },
  },
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOrVideo,
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: compactLexical,
      admin: { description: "Overrides the media's default caption for this block only." },
    },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: mediaAspectRatioOptions,
      defaultValue: 'original',
      admin: {
        description:
          'Original keeps the media proportions. Other ratios crop the image or video to fill the frame.',
      },
    },
    {
      name: 'playback',
      label: 'Playback',
      type: 'select',
      options: [
        { label: 'Ambient', value: 'ambient' },
        { label: 'Player', value: 'player' },
      ],
      defaultValue: 'ambient',
    },
    {
      name: 'width',
      admin: { hidden: true },
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Wide', value: 'wide' },
      ],
      defaultValue: 'default',
    },
  ],
}
