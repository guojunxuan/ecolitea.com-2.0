import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { MediaBanner } from '@/collections/Products/blocks/MediaBanner/config'
import { MediaCarousel } from '@/collections/Products/blocks/MediaCarousel/config'
import { MediaTabs } from '@/collections/Products/blocks/MediaTabs/config'
import { MediaAccordion } from '@/collections/Products/blocks/MediaAccordion/config'
import { MediaText } from '@/collections/Products/blocks/MediaText/config'
import {
  playbackField,
  videoPlaybackCondition,
} from '@/collections/Products/blocks/shared/playbackCondition'
import { themeField } from '@/collections/Products/blocks/shared/themeField'
import { compactLexical } from '@/fields/compactLexical'

const media = { name: 'media', type: 'upload', relationTo: 'media', filterOptions: imageOrVideo }
const requiredMedia = { ...media, required: true }
const body = { name: 'body', type: 'richText', editor: compactLexical }
const eyebrow = { name: 'eyebrow', type: 'text', maxLength: 40 }
const title = { name: 'title', type: 'text', maxLength: 80 }
const description = { description: expect.any(String) }
const mediaPosition = {
  name: 'mediaPosition',
  label: 'Media Position',
  type: 'select',
  required: true,
  defaultValue: 'right',
  options: [
    { label: 'Right', value: 'right' },
    { label: 'Left', value: 'left' },
  ],
}
const aspectRatio = (values: string[], defaultValue: string) => ({
  name: 'aspectRatio',
  label: 'Aspect Ratio',
  type: 'select',
  required: true,
  defaultValue,
  options: values.map((value) => ({ label: value === 'original' ? 'Original' : value, value })),
})

const cases = [
  {
    block: MediaBanner,
    name: 'MediaBanner',
    singular: 'Media Banner',
    plural: 'Media Banners',
    purpose: /banner/i,
    fields: [
      { ...requiredMedia, admin: description },
      { ...title, required: true },
      { name: 'content', type: 'textarea', maxLength: 200 },
      {
        ...aspectRatio([], '16:9'),
        options: [
          { label: 'Full Screen', value: 'full-screen' },
          { label: 'Wide 21:9', value: '21:9' },
          { label: 'Standard 16:9', value: '16:9' },
          { label: 'Original', value: 'original' },
        ],
      },
      themeField,
    ],
  },
  {
    block: MediaCarousel,
    name: 'MediaCarousel',
    singular: 'Media Carousel',
    plural: 'Media Carousels',
    purpose: /carousel/i,
    fields: [
      { ...eyebrow, admin: description },
      title,
      {
        name: 'slides',
        type: 'array',
        minRows: 2,
        maxRows: 12,
        admin: { initCollapsed: true },
        fields: [requiredMedia, playbackField, { name: 'caption', type: 'text', maxLength: 120 }],
      },
      aspectRatio(['21:9', '16:9', '4:3'], '16:9'),
      themeField,
    ],
  },
  {
    block: MediaTabs,
    name: 'MediaTabs',
    singular: 'Media Tabs',
    plural: 'Media Tabs',
    purpose: /tabs/i,
    fields: [
      { ...title, admin: description },
      {
        name: 'tabs',
        type: 'array',
        minRows: 2,
        maxRows: 6,
        admin: { initCollapsed: true },
        fields: [
          { name: 'label', type: 'text', required: true, maxLength: 40 },
          requiredMedia,
          playbackField,
        ],
      },
      aspectRatio(['21:9', '16:9', '4:3', '1:1'], '16:9'),
      themeField,
    ],
  },
  {
    block: MediaAccordion,
    name: 'MediaAccordion',
    singular: 'Media Accordion',
    plural: 'Media Accordions',
    purpose: /accordion/i,
    fields: [
      { ...eyebrow, admin: description },
      title,
      {
        name: 'items',
        type: 'array',
        minRows: 2,
        maxRows: 6,
        admin: { initCollapsed: true },
        fields: [
          { name: 'heading', type: 'text', required: true, maxLength: 80 },
          body,
          media,
          playbackField,
        ],
      },
      { ...requiredMedia, name: 'defaultMedia' },
      mediaPosition,
      aspectRatio(['1:1', '4:3', '4:5', '16:9'], '1:1'),
      themeField,
    ],
  },
  {
    block: MediaText,
    name: 'MediaText',
    singular: 'Media + Text',
    plural: 'Media + Text',
    purpose: /media.*text/i,
    fields: [
      { ...eyebrow, admin: description },
      { ...title, required: true },
      body,
      requiredMedia,
      playbackField,
      mediaPosition,
      aspectRatio(['21:9', '16:9', '4:3', '1:1', '4:5', 'original'], '1:1'),
      themeField,
    ],
  },
]

const allFields = (fields: Field[]): Field[] =>
  fields.flatMap((field) => [field, ...('fields' in field ? allFields(field.fields) : [])])

describe('Products media block schemas', () => {
  it.each(cases)('$name declares its identity and native Admin presentation', (entry) => {
    expect(entry.block.slug).toBe(`product${entry.name}`)
    expect(entry.block.interfaceName).toBe(`Product${entry.name}Block`)
    expect(entry.block.labels).toEqual({ singular: entry.singular, plural: entry.plural })
    expect(entry.block.admin).toEqual({
      group: 'Products',
      disableBlockName: true,
      images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
      components: {
        Label: {
          path: '@/blocks/BlockRowLabel#BlockRowLabel',
          clientProps: { label: entry.singular },
        },
      },
    })
    const firstFieldAdmin = entry.block.fields[0].admin
    expect(
      firstFieldAdmin && 'description' in firstFieldAdmin ? firstFieldAdmin.description : undefined,
    ).toMatch(entry.purpose)
  })

  it.each(cases)('$name declares exactly the ordered fields and native constraints', (entry) => {
    expect(entry.block.fields).toEqual(entry.fields)
  })

  it.each(cases)('$name reuses the upload filter and compact editor by reference', ({ block }) => {
    for (const field of allFields(block.fields)) {
      if (field.type === 'upload') expect(field.filterOptions).toBe(imageOrVideo)
      if (field.type === 'richText') expect(field.editor).toBe(compactLexical)
      if ('name' in field && field.name === 'playback') {
        expect(field.admin?.condition).toBe(videoPlaybackCondition)
        expect(field).not.toBe(playbackField)
      }
    }
  })

  it('uses independent shared field objects across schemas', () => {
    const fields = cases.flatMap(({ block }) => allFields(block.fields))
    for (const name of ['theme', 'playback']) {
      const sharedFields = fields.filter((field) => 'name' in field && field.name === name)
      expect(new Set(sharedFields).size).toBe(sharedFields.length)
      for (const field of sharedFields)
        expect(field).not.toBe(name === 'theme' ? themeField : playbackField)
    }
  })
})
