import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollapsibleField, GroupField, UploadField } from 'payload'

import { imageOnly } from '@/collections/mediaUploadPolicy'
import { settingsTabs } from '@/Settings/fields'
import { blogTab } from '@/Settings/fields/blog'
import { trimText } from '@/Settings/fields/validation'
import { validateSettingsSeoImage } from '@/Settings/hooks/validateSettingsSeoImage'
import { revalidateSettings } from '@/Settings/hooks/revalidateSettings'
import { revalidatePath, revalidateTag } from 'next/cache'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const productTab = () => settingsTabs.tabs[1]
const productSEO = () => {
  const section = productTab()?.fields.find(
    (field) => field.type === 'collapsible' && field.label === 'Listing SEO',
  ) as CollapsibleField
  return section?.fields[0] as GroupField
}

describe('Product Listing settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('places the shared Listing Hero before collapsed SEO after the Blog tab', () => {
    expect(settingsTabs.tabs).toHaveLength(2)
    expect(settingsTabs.tabs[0]).toBe(blogTab)
    expect(productTab()).toMatchObject({ name: 'product', label: 'Product' })
    expect(productTab().fields).toHaveLength(3)
    expect(productTab().fields[0]).toEqual(blogTab.fields[0])
    expect(productTab().fields[1]).toMatchObject({
      type: 'collapsible',
      label: 'Listing SEO',
      admin: { initCollapsed: true, style: { marginTop: 0, marginBottom: 'var(--spacer-2-5)' } },
    })
    expect(productSEO()).toMatchObject({ name: 'seo', label: false, type: 'group' })
    expect(productSEO().fields.map((field) => ('name' in field ? field.name : field.type))).toEqual(
      ['overview', 'title', 'description', 'image', 'preview'],
    )
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

  it('disables every Product Listing SEO generator because the plugin omits field paths', () => {
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
    expect(revalidatePath).toHaveBeenCalledWith('/products')
    expect(revalidateTag).toHaveBeenCalledWith('products-overview', 'max')
    vi.clearAllMocks()
    expect(
      revalidateSettings({ doc, req: { context: { disableRevalidate: true } } } as never),
    ).toBe(doc)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
