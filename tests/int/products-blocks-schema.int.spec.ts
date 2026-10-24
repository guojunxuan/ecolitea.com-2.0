import type { Block, Field } from 'payload'
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
import { productBlocks } from '@/collections/Products/blocks'
import { pageBlocks } from '@/collections/Pages/blocks'
import { caseStudyBlocks } from '@/collections/CaseStudies/blocks'
import { blogBlocks } from '@/collections/Blogs/blocks'
import { postBlocks } from '@/collections/Posts/blocks'
import { CardGroup, CategoryTabs, LinkGroup, RichCard } from '@/Header/blocks'

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
      { ...requiredMedia, name: 'defaultMedia', label: 'Default Media' },
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

describe('Products Code block and registry', () => {
  const getCode = async (): Promise<Block> =>
    (await import('@/collections/Products/blocks/Code/config')).Code

  it('declares the Custom Code identity and native Admin presentation', async () => {
    const code = await getCode()
    expect(code.slug).toBe('productCode')
    expect(code.interfaceName).toBe('ProductCodeBlock')
    expect(code.labels).toEqual({ singular: 'Custom Code', plural: 'Custom Code' })
    expect(code.admin).toEqual({
      group: 'Products',
      disableBlockName: true,
      images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
      components: {
        Label: {
          path: '@/blocks/BlockRowLabel#BlockRowLabel',
          clientProps: { label: 'Custom Code' },
        },
      },
    })
  })

  it('declares exactly the ordered Code fields, descriptions and native constraints', async () => {
    const code = await getCode()
    expect(code.fields).toEqual([
      {
        name: 'label',
        type: 'text',
        required: true,
        maxLength: 80,
        admin: {
          description: 'Identifies this block in the Admin list. Not shown on the live site.',
        },
      },
      {
        name: 'html',
        type: 'code',
        required: true,
        admin: {
          language: 'html',
          description:
            'Custom HTML content. Use {{asset:0}}, {{asset:1}}, etc. to reference assets below.',
        },
      },
      {
        name: 'css',
        type: 'code',
        admin: {
          language: 'css',
          description:
            'Optional inline styles. Use var(--color-foreground) and other tokens for theme-aware colors.',
        },
      },
      {
        name: 'js',
        type: 'code',
        admin: {
          language: 'javascript',
          description:
            'Optional inline script. Runs in a sandboxed iframe; cannot access the parent window.',
        },
      },
      {
        name: 'assets',
        type: 'upload',
        relationTo: 'media',
        hasMany: true,
        filterOptions: imageOrVideo,
        admin: {
          description:
            'Uploaded media for use in your HTML/CSS/JS. Reference them with {{asset:0}}, {{asset:1}}, etc.',
        },
      },
      {
        name: 'heightMode',
        label: 'Height Mode',
        type: 'select',
        options: [
          { label: 'Aspect Ratio', value: 'aspect' },
          { label: 'Fixed Height', value: 'fixed' },
        ],
        defaultValue: 'aspect',
        required: true,
      },
      {
        name: 'aspectRatio',
        label: 'Aspect Ratio',
        type: 'select',
        options: ['21:9', '16:9', '4:3', '1:1', '4:5'].map((value) => ({ label: value, value })),
        defaultValue: '16:9',
        admin: { condition: expect.any(Function) },
      },
      {
        name: 'height',
        label: 'Desktop Height (px)',
        type: 'number',
        defaultValue: 600,
        admin: {
          description: 'Fixed height for desktop viewports.',
          condition: expect.any(Function),
        },
      },
      {
        name: 'mobileHeight',
        label: 'Mobile Height (px)',
        type: 'number',
        defaultValue: 400,
        admin: {
          description: 'Fixed height for mobile viewports.',
          condition: expect.any(Function),
        },
      },
      {
        name: 'width',
        type: 'select',
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Full Width', value: 'full' },
        ],
        defaultValue: 'standard',
        required: true,
      },
      themeField,
    ])
    expect(code.fields.find((field) => 'name' in field && field.name === 'assets')).toHaveProperty(
      'filterOptions',
      imageOrVideo,
    )
    expect(code.fields.at(-1)).not.toBe(themeField)
  })

  it.each(['aspectRatio', 'height', 'mobileHeight'])(
    'shows %s only for its height mode and preserves stored values',
    async (name) => {
      const code = await getCode()
      const field = code.fields.find((field) => 'name' in field && field.name === name)!
      const data = { heightMode: 'fixed', aspectRatio: '4:5', height: 720, mobileHeight: 480 }
      const before = structuredClone(data)
      for (const heightMode of ['aspect', 'fixed', undefined]) {
        expect(field.admin?.condition?.({}, { ...data, heightMode }, {} as never)).toBe(
          heightMode === (name === 'aspectRatio' ? 'aspect' : 'fixed'),
        )
      }
      expect(field.admin?.condition?.({}, undefined as never, {} as never)).toBe(false)
      expect(data).toEqual(before)
      expect(field).not.toHaveProperty('required', true)
      expect(field).not.toHaveProperty('min')
      expect(field).not.toHaveProperty('max')
    },
  )

  it('registers exactly six ordered product blocks with globally unique slugs and interfaces', () => {
    expect(productBlocks.map(({ slug }) => slug)).toEqual([
      'productMediaBanner',
      'productMediaCarousel',
      'productMediaTabs',
      'productMediaAccordion',
      'productMediaText',
      'productCode',
    ])
    const all = [
      ...productBlocks,
      ...pageBlocks,
      ...caseStudyBlocks,
      ...blogBlocks,
      ...postBlocks,
      CategoryTabs,
      CardGroup,
      LinkGroup,
      RichCard,
    ]
    expect(new Set(all.map(({ slug }) => slug)).size).toBe(all.length)
    expect(new Set(all.map(({ interfaceName }) => interfaceName)).size).toBe(all.length)
  })
})
