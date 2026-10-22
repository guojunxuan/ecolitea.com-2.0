import { describe, expect, it, vi } from 'vitest'

import { generateDescription, generateImage, generateTitle, generateURL } from '@/plugins'
import { productTab } from '@/Settings/fields/product'
import { getServerSideURL } from '@/utilities/getURL'

const input = (slug: 'products' | 'product-categories', doc: Record<string, unknown>) => ({
  collectionConfig: { slug },
  doc,
})

describe('Product SEO generation', () => {
  it.each([
    ['product-categories', { title: 'Green Tea', slug: 'green-tea', description: 'Tea range' }, 'Green Tea Products | Ecolitea', 'Tea range', '/products/green-tea'],
    ['product-categories', { title: 'Green Tea', slug: 'green-tea' }, 'Green Tea Products | Ecolitea', 'Explore our green tea products.', '/products/green-tea'],
    ['product-categories', {}, 'Ecolitea', 'Explore our product range.', '/products'],
    ['products', { title: 'Sencha', slug: 'sencha', categorySlug: 'green-tea', excerpt: 'Fresh leaves' }, 'Sencha | Ecolitea', 'Fresh leaves', '/products/green-tea/sencha'],
    ['products', { title: 'Sencha', slug: 'sencha', excerpt: 'Fresh leaves' }, 'Sencha | Ecolitea', 'Fresh leaves', '/products'],
    ['products', { title: 'Sencha', categorySlug: 'green-tea' }, 'Sencha | Ecolitea', '', '/products'],
    ['products', {}, 'Ecolitea', '', '/products'],
  ] as const)('generates %s SEO from %j', (slug, doc, title, description, path) => {
    const args = input(slug, doc)
    expect(generateTitle(args as never)).toBe(title)
    expect(generateDescription(args as never)).toBe(description)
    expect(generateURL(args as never)).toBe(`${getServerSideURL()}${path}`)
  })

  it('keeps Product Listing generation disabled because plugin callbacks lack a field path', () => {
    const section = productTab.fields[0]
    if (!('fields' in section)) throw new Error('Missing SEO section')
    const seo = section.fields[0]
    if (!('fields' in seo)) throw new Error('Missing SEO fields')
    const [, title, description, image, preview] = seo.fields
    expect(title.admin?.components?.Field).toMatchObject({ clientProps: { hasGenerateTitleFn: false } })
    expect(description.admin?.components?.Field).toMatchObject({ clientProps: { hasGenerateDescriptionFn: false } })
    expect(image.admin?.components?.Field).toMatchObject({ clientProps: { hasGenerateImageFn: false } })
    expect(preview.admin?.components?.Field).toMatchObject({ clientProps: { hasGenerateURLFn: false } })
  })

  it.each([
    ['product-categories', { image: 'category-image' }, 'category-image'],
    ['product-categories', { image: { id: 'category-image' } }, 'category-image'],
    ['products', { gallery: ['cover', 'second'] }, 'cover'],
    ['products', { gallery: [{ id: 'cover' }, 'second'] }, 'cover'],
  ] as const)('validates %s source image %j', async (slug, doc, expected) => {
    const req = { payload: { findByID: vi.fn().mockResolvedValue({ mimeType: 'image/jpeg' }) } }
    expect(await generateImage({ ...input(slug, doc), req } as never)).toBe(expected)
    expect(req.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'media', id: expected, depth: 0, overrideAccess: false, req,
    }))
  })

  it.each([
    ['product-categories', {}],
    ['products', { gallery: [] }],
    ['products', { gallery: [{}, 'second'] }],
  ] as const)('retains current image when %s source is missing: %j', async (slug, doc) => {
    const req = { payload: { findByID: vi.fn() } }
    expect(await generateImage({ ...input(slug, { ...doc, meta: { image: { id: 'current' } } }), req } as never)).toBe('current')
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it.each([
    ['products', { gallery: ['cover'] }, 'video/mp4'],
    ['products', { gallery: ['cover'] }, undefined],
    ['product-categories', { image: 'cover' }, 'application/pdf'],
  ] as const)('retains current image for invalid %s source %j with MIME %s', async (slug, doc, mimeType) => {
    const req = { payload: { findByID: vi.fn().mockResolvedValue({ mimeType }) } }
    expect(await generateImage({ ...input(slug, { ...doc, meta: { image: 'current' } }), req } as never)).toBe('current')
  })

  it.each([403, 404])('retains current image when source lookup returns %i', async (status) => {
    const req = { payload: { findByID: vi.fn().mockRejectedValue({ status }) } }
    expect(await generateImage({ ...input('product-categories', { image: 'cover', meta: { image: 'current' } }), req } as never)).toBe('current')
  })
})
