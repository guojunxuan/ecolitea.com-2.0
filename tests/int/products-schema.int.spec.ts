import { describe, expect, it } from 'vitest'
import { ProductCategories } from '@/collections/ProductCategories'
import { productBlocks } from '@/collections/Products/blocks'
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
    expect(seo?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'ui' }),
        expect.objectContaining({ name: 'title', type: 'text' }),
        expect.objectContaining({ name: 'description', type: 'textarea' }),
      ]),
    )
    expect(seo?.fields.filter((field) => field.type === 'ui')).toHaveLength(2)
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

describe('Products configuration', () => {
  it('registers both Product collections and the required publishing settings', async () => {
    const config = await (await import('@/payload.config')).default
    const products = config.collections.find(({ slug }) => slug === 'products')
    expect(config.collections.some(({ slug }) => slug === 'product-categories')).toBe(true)
    expect(products).toMatchObject({
      labels: { singular: 'Product', plural: 'Products' },
      admin: {
        group: 'Product',
        useAsTitle: 'title',
        defaultColumns: ['title', 'category', 'publishedAt', '_status'],
      },
      versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true }, maxPerDoc: 50 },
      defaultPopulate: {
        title: true,
        slug: true,
        categorySlug: true,
        category: true,
        gallery: true,
        summary: true,
        publishedAt: true,
      },
    })
  })

  it('defines overview, sections, SEO and protected sidebar fields', async () => {
    const { Products } = await import('@/collections/Products')
    const tabs = Products.fields.find((field) => field.type === 'tabs')
    if (tabs?.type !== 'tabs') throw new Error('Missing product tabs')
    const overview = tabs.tabs.find((tab) => tab.label === 'Overview')!
    expect(overview.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'gallery',
          type: 'upload',
          relationTo: 'media',
          hasMany: true,
          minRows: 1,
          required: true,
          filterOptions: imageOnly,
        }),
        expect.objectContaining({
          name: 'summary',
          type: 'textarea',
          required: true,
          maxLength: 160,
        }),
        expect.objectContaining({
          name: 'overview',
          type: 'textarea',
          label: 'Overview text',
          maxLength: 1500,
        }),
        expect.objectContaining({
          name: 'resources',
          label: 'Resources',
          type: 'upload',
          hasMany: true,
          relationTo: 'documents',
        }),
      ]),
    )
    expect(overview.fields.map((field) => 'name' in field && field.name)).toEqual([
      'gallery',
      'summary',
      'overview',
      'resources',
    ])
    expect(tabs.tabs.map((tab) => tab.label)).toEqual([
      'Overview',
      'Specifications',
      'Details',
      'SEO',
    ])
    const specificationTab = tabs.tabs.find((tab) => tab.label === 'Specifications')
    expect(specificationTab).not.toHaveProperty('name')
    expect(specificationTab?.fields).toMatchObject([
      {
        name: 'specifications',
        type: 'array',
        admin: {
          components: {
            RowLabel:
              '@/collections/Products/admin/SpecificationGroupRowLabel#SpecificationGroupRowLabel',
          },
        },
        fields: expect.arrayContaining([
          expect.objectContaining({ name: 'group', type: 'text' }),
          expect.objectContaining({
            name: 'items',
            type: 'array',
            required: true,
            minRows: 1,
            admin: {
              components: {
                RowLabel:
                  '@/collections/Products/admin/SpecificationRowLabel#SpecificationRowLabel',
              },
            },
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'label', type: 'text', required: true }),
              expect.objectContaining({ name: 'value', type: 'text', required: true }),
            ]),
          }),
        ]),
      },
    ])
    expect(tabs.tabs.find((tab) => tab.label === 'Details')).toMatchObject({
      fields: [
        {
          name: 'sections',
          type: 'array',
          maxRows: 8,
          admin: {
            initCollapsed: true,
            description:
              'Each section becomes a tab in the sticky section nav on the product page, in this order. Sections without blocks are hidden.',
            components: {
              RowLabel: '@/collections/Products/admin/SectionRowLabel#SectionRowLabel',
            },
          },
          fields: expect.arrayContaining([
            expect.objectContaining({ name: 'label', type: 'text', required: true, maxLength: 40 }),
            expect.objectContaining({ name: 'anchor', type: 'text' }),
            expect.objectContaining({ name: 'blocks', type: 'blocks', blocks: productBlocks }),
          ]),
        },
      ],
    })
    for (const name of ['excerpt', 'specs', 'layout', 'downloads', 'faqs'])
      expect(
        tabs.tabs
          .flatMap((tab) => tab.fields)
          .some((field) => 'name' in field && field.name === name),
      ).toBe(false)
    const seo = tabs.tabs.find((tab) => 'name' in tab && tab.name === 'meta')!
    expect(seo.fields.map((field) => ('name' in field ? field.name : field.type))).toEqual(
      expect.arrayContaining(['title', 'image', 'description']),
    )
    const slug = Products.fields.find((field) => 'name' in field && field.name === 'slug')!
    if (slug.type !== 'slug') throw new Error('Missing native slug')
    expect(slug.validate?.('page' as never, {} as never)).toBe(
      'Slug cannot be "page" (reserved word).',
    )
    expect(slug.validate?.('category' as never, {} as never)).toBe(true)
    const categorySlug = Products.fields.find(
      (field) => 'name' in field && field.name === 'categorySlug',
    )!
    if (categorySlug.type !== 'text') throw new Error('Missing cached category slug')
    expect(categorySlug.admin?.hidden).toBe(true)
    expect(categorySlug.access?.update?.({} as never)).toBe(false)
    const related = Products.fields.find(
      (field) => 'name' in field && field.name === 'relatedProducts',
    )!
    if (related.type !== 'relationship') throw new Error('Missing related products')
    expect(related.maxRows).toBe(8)
    if (typeof related.filterOptions !== 'function')
      throw new Error('Missing related product filter')
    expect(related.filterOptions?.({ id: 'self' } as never)).toEqual({ id: { not_in: ['self'] } })
  })
})
