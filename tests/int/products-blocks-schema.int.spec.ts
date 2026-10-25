import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Block, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { MediaBanner } from '@/collections/Products/blocks/MediaBanner/config'
import { MediaCarousel } from '@/collections/Products/blocks/MediaCarousel/config'
import { MediaTabs } from '@/collections/Products/blocks/MediaTabs/config'
import { MediaAccordion } from '@/collections/Products/blocks/MediaAccordion/config'
import { MediaText } from '@/collections/Products/blocks/MediaText/config'
import { playbackField } from '@/collections/Products/blocks/shared/playbackField'
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
  options: values.map((value) => ({
    label: value === 'original' ? 'Original' : value === 'full-screen' ? 'Full Screen' : value,
    value,
  })),
})

const cases = [
  {
    block: MediaBanner,
    name: 'MediaBanner',
    singular: 'Media Banner',
    plural: 'Media Banners',
    purpose: /banner/i,
    fields: [
      { ...title, required: true, admin: description },
      { name: 'body', type: 'textarea', maxLength: 200 },
      requiredMedia,
      playbackField,
      {
        type: 'row',
        fields: [aspectRatio(['full-screen', '21:9', '16:9', 'original'], '16:9'), themeField],
      },
    ],
  },
  {
    block: MediaCarousel,
    name: 'MediaCarousel',
    singular: 'Media Carousel',
    plural: 'Media Carousels',
    purpose: /^Optional short label shown above the title\.$/,
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
      { type: 'row', fields: [aspectRatio(['21:9', '16:9', '4:3'], '16:9'), themeField] },
    ],
  },
  {
    block: MediaTabs,
    name: 'MediaTabs',
    singular: 'Media Tabs',
    plural: 'Media Tabs',
    purpose: /^Optional short label shown above the title\.$/,
    fields: [
      { ...eyebrow, admin: description },
      title,
      {
        name: 'tabs',
        type: 'array',
        minRows: 2,
        maxRows: 6,
        admin: { initCollapsed: true },
        fields: [
          { name: 'title', type: 'text', required: true, maxLength: 40 },
          requiredMedia,
          playbackField,
        ],
      },
      { type: 'row', fields: [aspectRatio(['21:9', '16:9', '4:3', '1:1'], '16:9'), themeField] },
    ],
  },
  {
    block: MediaAccordion,
    name: 'MediaAccordion',
    singular: 'Media Accordion',
    plural: 'Media Accordions',
    purpose: /^Optional short label shown above the title\.$/,
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
          { name: 'title', type: 'text', required: true, maxLength: 80 },
          body,
          media,
          playbackField,
        ],
      },
      { ...requiredMedia, name: 'defaultMedia', label: 'Default Media' },
      {
        type: 'row',
        fields: [mediaPosition, aspectRatio(['4:5', '1:1', '4:3'], '1:1'), themeField],
      },
    ],
  },
  {
    block: MediaText,
    name: 'MediaText',
    singular: 'Media + Text',
    plural: 'Media + Text',
    purpose: /^Optional short label shown above the title\.$/,
    fields: [
      { ...eyebrow, admin: description },
      { ...title, required: true },
      body,
      requiredMedia,
      playbackField,
      {
        type: 'row',
        fields: [
          mediaPosition,
          aspectRatio(['4:5', '1:1', '4:3', '16:9', 'original'], '4:3'),
          themeField,
        ],
      },
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
      images: {
        icon: `/block-previews/product-${entry.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.svg`,
        thumbnail: `/block-previews/product-${entry.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.svg`,
      },
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
        expect(field.admin).not.toHaveProperty('condition')
        expect(field).toBe(playbackField)
      }
    }
  })

  it('reuses shared fields directly across schemas', () => {
    const fields = cases.flatMap(({ block }) => allFields(block.fields))
    for (const name of ['theme', 'playback']) {
      const sharedFields = fields.filter((field) => 'name' in field && field.name === name)
      expect(new Set(sharedFields).size).toBe(1)
      for (const field of sharedFields)
        expect(field).toBe(name === 'theme' ? themeField : playbackField)
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
      images: {
        icon: '/block-previews/product-code.svg',
        thumbnail: '/block-previews/product-code.svg',
      },
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
        type: 'row',
        fields: [
          {
            name: 'minHeight',
            type: 'number',
            required: true,
            defaultValue: 400,
            min: 100,
            max: 2000,
            admin: {
              description: 'Placeholder height in px until the content reports its real height.',
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
        ],
      },
    ])
    expect(code.fields.find((field) => 'name' in field && field.name === 'assets')).toHaveProperty(
      'filterOptions',
      imageOrVideo,
    )
    expect(allFields(code.fields)).toContain(themeField)
  })

  it('removes legacy vocabulary and Code heights and provides distinct existing wireframe previews', () => {
    for (const block of productBlocks) {
      const names = allFields(block.fields).map((field) =>
        'name' in field ? field.name : field.type,
      )
      expect(names).not.toContain('content')
      expect(names).not.toContain('heading')
      if (block.slug === 'productMediaTabs') expect(names).not.toContain('label')
      if (block.slug === 'productCode')
        for (const name of ['heightMode', 'aspectRatio', 'height', 'mobileHeight'])
          expect(names).not.toContain(name)
      for (const url of [block.admin?.images?.icon, block.admin?.images?.thumbnail]) {
        expect(url).toMatch(/^\/block-previews\/product-.*\.svg$/)
        const svg = readFileSync(resolve('public', String(url).slice(1)), 'utf8')
        expect(svg).toContain('viewBox="0 0 480 320"')
        expect(svg).toContain('stroke-width="8"')
        expect(svg).not.toMatch(/<text|fill="(?!none)/)
      }
    }
    expect(new Set(productBlocks.map((block) => block.admin?.images?.icon)).size).toBe(6)
  })

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
