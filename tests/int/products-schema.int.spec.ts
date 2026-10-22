import { describe, expect, it } from 'vitest'
import { ProductCategories } from '@/collections/ProductCategories'
import { imageOnly } from '@/collections/mediaUploadPolicy'

describe('Product category configuration', () => {
  it('is an ordered, unversioned Product collection with public reads and authenticated writes', async () => {
    expect(ProductCategories).toMatchObject({
      slug: 'product-categories',
      labels: { singular: 'Product Category', plural: 'Product Categories' },
      admin: {
        group: 'Product',
        useAsTitle: 'title',
        defaultColumns: ['title', 'slug'],
      },
      orderable: true,
    })
    expect(ProductCategories.versions).toBeUndefined()
    expect(await ProductCategories.access!.read!({ req: { user: null } } as never)).toBe(true)
    for (const operation of ['create', 'update', 'delete'] as const) {
      const access = ProductCategories.access![operation]!
      expect(await access({ req: { user: null } } as never)).toBe(false)
      expect(await access({ req: { user: { id: 'editor' } } } as never)).toBe(true)
    }
  })

  it('defines required category images, native SEO, a sidebar slug, and the products join', () => {
    const tabs = ProductCategories.fields.find((field) => field.type === 'tabs')
    if (tabs?.type !== 'tabs') throw new Error('Missing product category tabs')
    expect(tabs.tabs[0]).toMatchObject({
      label: 'Content',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: imageOnly,
        },
      ],
    })
    const seo = tabs.tabs.find((tab) => 'name' in tab && tab.name === 'meta')
    expect(seo).toMatchObject({ label: 'SEO' })
    expect(seo?.fields.map((field) => ('name' in field ? field.name : field.type))).toEqual(
      expect.arrayContaining(['title', 'image', 'description']),
    )
    expect(seo?.fields.find((field) => 'name' in field && field.name === 'image')).toMatchObject({
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOnly,
      admin: { components: { Field: { clientProps: { hasGenerateImageFn: true } } } },
    })
    expect(ProductCategories.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'slug',
          type: 'slug',
          useAsSlug: 'title',
          admin: { position: 'sidebar' },
        }),
        expect.objectContaining({
          name: 'products',
          type: 'join',
          collection: 'products',
          on: 'category',
        }),
      ]),
    )
  })
})
