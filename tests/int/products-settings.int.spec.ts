import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ArrayField,
  CollapsibleField,
  Field,
  GroupField,
  SelectField,
  UploadField,
} from 'payload'

import { Settings } from '@/Settings/config'
import { imageOnly } from '@/collections/mediaUploadPolicy'
import { settingsTabs } from '@/Settings/fields'
import { blogTab } from '@/Settings/fields/blog'
import { trimText } from '@/Settings/fields/validation'
import { validateSettingsSeoImage } from '@/Settings/hooks/validateSettingsSeoImage'
import { revalidateSettings } from '@/Settings/hooks/revalidateSettings'
import { revalidatePath, revalidateTag } from 'next/cache'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const productTab = () => settingsTabs.tabs[1]
const overview = () => productTab().fields[0] as GroupField
const productSEO = () => {
  const section = overview().fields.find(
    (field) => field.type === 'collapsible' && field.label === 'SEO',
  ) as CollapsibleField
  return section?.fields[0] as GroupField
}

describe('Product Overview settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('places slide Hero and category controls before SEO with only canonical Hero fields', () => {
    expect(settingsTabs.tabs).toHaveLength(2)
    expect(settingsTabs.tabs[0]).toBe(blogTab)
    expect(productTab()).toMatchObject({ name: 'product', label: 'Product' })
    expect(productTab().fields).toHaveLength(1)
    expect(overview()).toMatchObject({ type: 'group', label: 'Overview' })
    expect(overview()).not.toHaveProperty('name')
    expect(productTab().fields).not.toContainEqual(expect.objectContaining({ name: 'inquiry' }))
    const hero = overview().fields[0] as CollapsibleField
    expect(hero).toMatchObject({ type: 'collapsible', label: 'Hero' })
    expect(hero.fields).toEqual([expect.objectContaining({ name: 'heroSlides', type: 'array' })])
    expect(overview().fields[2]).toMatchObject({
      type: 'collapsible',
      label: 'SEO',
      admin: { initCollapsed: true },
    })
    expect(productSEO()).toMatchObject({ name: 'seo', label: false, type: 'group' })
    expect(productSEO().fields.map((field) => ('name' in field ? field.name : field.type))).toEqual(
      ['overview', 'title', 'description', 'image', 'preview'],
    )
  })

  it('uses native versions, new themes, mobile uploads, labelled unique category items and visible disabled configuration', async () => {
    expect(Settings.versions).toEqual({ max: 20 })
    const hero = overview().fields[0] as CollapsibleField
    const slides = hero.fields.find((f) => 'name' in f && f.name === 'heroSlides') as ArrayField
    expect(slides.admin?.components?.RowLabel).toBe(
      '@/Settings/components/HeroSlideRowLabel#HeroSlideRowLabel',
    )
    const flatten = (fields: Field[]): Field[] =>
      fields.flatMap((f) => ('fields' in f ? [f, ...flatten(f.fields)] : [f]))
    const fields = flatten(slides.fields)
    expect(fields.find((f) => 'name' in f && f.name === 'mobileMedia')).toMatchObject({
      type: 'upload',
      relationTo: 'media',
    })
    expect(fields.find((f) => 'name' in f && f.name === 'theme')).toMatchObject({
      label: 'Header Theme',
      defaultValue: 'dark',
      options: [
        { label: 'dark', value: 'dark' },
        { label: 'light', value: 'light' },
      ],
    })
    expect(slides.fields.map((field) => 'name' in field && field.name)).toEqual([
      'showText', 'title', 'description', 'media', 'mobileMedia', 'theme', 'enableCta', 'cta',
    ])
    expect(fields.find((field) => 'name' in field && field.name === 'title')).toMatchObject({
      label: 'Title',
    })
    expect(fields.find((field) => 'name' in field && field.name === 'description')).toMatchObject({
      label: 'Description',
    })
    const theme = fields.find(
      (field) => 'name' in field && field.name === 'theme',
    ) as import('payload').SelectField
    expect(theme.admin?.hidden).not.toBe(true)
    expect(theme.hooks).toBeUndefined()
    const desktop = fields.find(
      (field) => 'name' in field && field.name === 'media',
    ) as UploadField
    const validateMedia = desktop.validate as (value: unknown, options: never) => unknown
    const req = { t: (key: string) => key }
    expect(await validateMedia(null, { req, siblingData: { showText: true } } as never)).toBe(true)
    expect(await validateMedia(null, { req, siblingData: { showText: false } } as never)).toBe(
      'validation:required',
    )
    expect(fields.find((field) => 'name' in field && field.name === 'enableCta')).toMatchObject({
      label: 'Enable CTA link',
      defaultValue: false,
    })
    const cta = fields.find((field) => 'name' in field && field.name === 'cta') as GroupField
    expect(cta.admin?.hidden).not.toBe(true)
    expect(cta.admin?.condition?.({}, { enableCta: true }, {} as never)).toBe(true)
    expect(cta.admin?.condition?.({}, { enableCta: false }, {} as never)).toBe(false)
    const group = (overview().fields[1] as CollapsibleField).fields[0] as GroupField
    const items = group.fields.find((f) => 'name' in f && f.name === 'items') as ArrayField
    expect(items.admin?.condition).toBeUndefined()
    expect(items.admin?.components?.RowLabel).toBe(
      '@/Settings/components/CategoryCarouselRowLabel#CategoryCarouselRowLabel',
    )
    expect(items.fields.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'category',
      'image',
      'imageFit',
    ])
    const imageFit = items.fields.find((f) => 'name' in f && f.name === 'imageFit') as SelectField
    const condition = imageFit.admin?.condition
    expect(condition).toBeTypeOf('function')
    const selected = { image: 'override', imageFit: 'contain' }
    for (const image of [undefined, null, ''])
      expect(condition?.({}, { image, imageFit: 'contain' }, {} as never)).toBe(false)
    expect(condition?.({}, selected, {} as never)).toBe(true)
    expect(condition?.({}, { image: { id: 'override' } }, {} as never)).toBe(true)
    expect(selected).toEqual({ image: 'override', imageFit: 'contain' })
    expect(items.validate).toBeTypeOf('function')
    const validate = items.validate as (value: unknown, options: never) => unknown
    expect(
      await validate([{ category: 'a' }, { category: { id: 'a' } }], {
        req: { t: (key: string) => key },
      } as never),
    ).toBeTypeOf('string')
    expect(
      await validate([{ category: 'a' }, { category: 'b' }], {
        req: { t: (key: string) => key },
      } as never),
    ).toBe(true)
  })

  it('uses nested preview paths, shared trim hooks and image-only Media filter', () => {
    const [overview, title, description, image, preview] = productSEO().fields
    expect(overview).toMatchObject({
      admin: {
        components: {
          Field: {
            clientProps: {
              titlePath: 'product.seo.title',
              descriptionPath: 'product.seo.description',
              imagePath: 'product.seo.image',
            },
          },
        },
      },
    })
    expect(title).toMatchObject({ hooks: { beforeValidate: [trimText] } })
    expect(description).toMatchObject({ hooks: { beforeValidate: [trimText] } })
    expect(image).toMatchObject({ type: 'upload', relationTo: 'media' })
    expect((image as UploadField).filterOptions).toEqual(imageOnly)
    expect(preview).toMatchObject({
      admin: {
        components: {
          Field: {
            clientProps: {
              titlePath: 'product.seo.title',
              descriptionPath: 'product.seo.description',
            },
          },
        },
      },
    })
  })

  it('disables every Product SEO generator because the plugin omits field paths', () => {
    const [, title, description, image, preview] = productSEO().fields
    expect(title.admin?.components?.Field).toMatchObject({
      clientProps: { hasGenerateTitleFn: false },
    })
    expect(description.admin?.components?.Field).toMatchObject({
      clientProps: { hasGenerateDescriptionFn: false },
    })
    expect(image.admin?.components?.Field).toMatchObject({
      clientProps: { hasGenerateImageFn: false },
    })
    expect(preview.admin?.components?.Field).toMatchObject({
      clientProps: { hasGenerateURLFn: false },
    })
  })

  it('rejects non-images at the Product SEO path and checks retained images on partial writes', async () => {
    const findByID = vi.fn().mockResolvedValue({ mimeType: 'video/mp4' })
    const originalDoc = { product: { seo: { image: 'retained' } } }
    const data = { blog: { seo: { title: 'Keep me' } } }
    await expect(
      validateSettingsSeoImage({ data, originalDoc, req: { payload: { findByID } } } as never),
    ).rejects.toMatchObject({ status: 400, data: { errors: [{ path: 'product.seo.image' }] } })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 'retained', depth: 0 }),
    )
    findByID.mockResolvedValue({ mimeType: 'image/jpeg' })
    await expect(
      validateSettingsSeoImage({ data, originalDoc, req: { payload: { findByID } } } as never),
    ).resolves.toBe(data)
    expect(data).toEqual({ blog: { seo: { title: 'Keep me' } } })
  })

  it('revalidates the Products overview path and tag unless disabled', () => {
    const doc = { product: { seo: { title: 'Products' } } }
    expect(revalidateSettings({ doc, req: { context: {} } } as never)).toBe(doc)
    expect(revalidateTag).toHaveBeenCalledWith('global_settings', 'max')
    expect(revalidatePath).toHaveBeenCalledWith('/en/products')
    for (const path of [
      '/[lang]/products/[category]',
      '/[lang]/products/[category]/page/[pageNumber]',
      '/[lang]/products/[category]/[product]',
    ])
      expect(revalidatePath).toHaveBeenCalledWith(path, 'page')
    expect(revalidateTag).toHaveBeenCalledWith('products-overview', 'max')
    vi.clearAllMocks()
    expect(
      revalidateSettings({ doc, req: { context: { disableRevalidate: true } } } as never),
    ).toBe(doc)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
