import { beforeEach, describe, expect, it, vi } from 'vitest'

const { find, findByID, redirects, redirect, permanentRedirect, notFound } = vi.hoisted(() => ({
  find: vi.fn(),
  findByID: vi.fn(),
  redirects: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('TEMPORARY_REDIRECT')
  }),
  permanentRedirect: vi.fn(() => {
    throw new Error('PERMANENT_REDIRECT')
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/utilities/getRedirects', () => ({ getCachedRedirects: () => redirects }))
vi.mock('next/navigation', () => ({ redirect, permanentRedirect, notFound }))
vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  getPayload: async () => ({ find, findByID }),
}))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))

import { internalDocToHref } from '@/components/RichText'
import { articleLinkFeature } from '@/fields/defaultLexical'
import { resolveLinkHref } from '@/components/Link'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { publicSearchVisibility } from '@/search/visibility'
import { PayloadRedirects } from '@/components/PayloadRedirects'

beforeEach(() => {
  find.mockReset()
  findByID.mockReset()
  redirects.mockReset()
  redirect.mockClear()
  permanentRedirect.mockClear()
  notFound.mockClear()
})

describe('Products site integration', () => {
  it('resolves populated product links and fails closed without categorySlug', () => {
    expect(
      resolveLinkHref({
        type: 'reference',
        reference: {
          relationTo: 'products',
          value: { slug: 'tea', categorySlug: 'green' } as never,
        },
      }),
    ).toBe('/products/green/tea')
    expect(
      resolveLinkHref({
        type: 'reference',
        reference: { relationTo: 'products', value: { slug: 'tea' } as never },
      }),
    ).toBeNull()
    expect(
      resolveLinkHref({
        type: 'reference',
        reference: { relationTo: 'product-categories', value: { slug: 'green' } as never },
      }),
    ).toBe('/products/green')
  })

  it('resolves product rich text links and enables both link collections', () => {
    const link = (relationTo: string, value: unknown) =>
      internalDocToHref({ linkNode: { fields: { doc: { relationTo, value } } } as never })
    expect(link('products', { slug: 'tea', categorySlug: 'green' })).toBe('/products/green/tea')
    expect(link('product-categories', { slug: 'green' })).toBe('/products/green')
    expect(link('products', { slug: 'tea' })).toBe('#')
    expect(link('products', 'private-id')).toBe('#')
    expect(JSON.stringify(articleLinkFeature())).toContain('products')
    expect(JSON.stringify(articleLinkFeature())).toContain('product-categories')
  })

  it('indexes product summary, first gallery image, category and visibility date', async () => {
    findByID.mockResolvedValue({ id: 'cat', title: 'Green', slug: 'green' })
    const result = await beforeSyncWithSearch({
      req: { payload: { findByID } },
      originalDoc: {
        slug: 'tea',
        title: 'Tea',
        summary: 'Fresh',
        gallery: [{ id: 'cover' }, 'second'],
        category: 'cat',
        categorySlug: 'green',
        publishedAt: '2026-01-01',
      },
      searchDoc: { doc: { relationTo: 'products', value: 'p1' } },
    } as never)
    expect(result).toMatchObject({
      slug: 'tea',
      categorySlug: 'green',
      excerpt: 'Fresh',
      heroImage: 'cover',
      publishedAt: '2026-01-01',
      category: {
        relationTo: 'product-categories',
        categoryID: 'cat',
        title: 'Green',
        slug: 'green',
      },
      meta: { title: 'Tea', description: 'Fresh', image: 'cover' },
    })
    expect(publicSearchVisibility(new Date('2026-01-02'))).toMatchObject({
      or: expect.arrayContaining([
        {
          and: [
            { 'doc.relationTo': { equals: 'blogs' } },
            { publishedAt: { less_than_equal: '2026-01-02T00:00:00.000Z' } },
          ],
        },
        {
          and: [
            { 'doc.relationTo': { equals: 'products' } },
            { publishedAt: { less_than_equal: '2026-01-02T00:00:00.000Z' } },
          ],
        },
      ]),
    })
  })

  it.each([
    [
      'products',
      { summary: 'Product summary', excerpt: 'Wrong product source' },
      'Product summary',
    ],
    ['blogs', { excerpt: 'Blog excerpt', summary: 'Wrong blog source' }, 'Blog excerpt'],
  ] as const)(
    'projects %s content into the shared search excerpt field',
    async (collection, content, expected) => {
      const result = await beforeSyncWithSearch({
        req: { payload: { findByID } },
        originalDoc: { title: 'Tea', slug: 'tea', ...content },
        searchDoc: { doc: { relationTo: collection, value: 'doc' } },
      } as never)
      expect(result).toMatchObject({ excerpt: expected, meta: { description: expected } })
      expect(result).not.toHaveProperty('summary')
    },
  )

  it.each(['products', 'product-categories'] as const)(
    'permanently redirects %s references to their current public path',
    async (relationTo) => {
      redirects.mockResolvedValue([
        {
          from: '/products/old',
          to: {
            type: 'reference',
            reference: {
              relationTo,
              value: { id: 'target', slug: 'stale', categorySlug: 'stale' },
            },
          },
        },
      ])
      find.mockResolvedValue({ docs: [{ id: 'visible' }] })
      findByID.mockResolvedValue({
        id: 'target',
        slug: 'tea',
        categorySlug: 'green',
        _status: 'published',
        publishedAt: '2020-01-01',
      })
      await expect(PayloadRedirects({ url: '/products/old' })).rejects.toThrow('PERMANENT_REDIRECT')
      expect(permanentRedirect).toHaveBeenCalledWith(
        `/products/${relationTo === 'products' ? 'green/tea' : 'tea'}`,
      )
      expect(redirect).not.toHaveBeenCalled()
      expect(findByID).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'target', draft: false, overrideAccess: false }),
      )
      findByID.mockResolvedValue({
        id: 'target',
        slug: 'renamed',
        categorySlug: 'new',
        _status: 'published',
        publishedAt: '2020-01-01',
      })
      await expect(PayloadRedirects({ url: '/products/old' })).rejects.toThrow('PERMANENT_REDIRECT')
      expect(permanentRedirect).toHaveBeenLastCalledWith(
        `/products/${relationTo === 'products' ? 'new/renamed' : 'renamed'}`,
      )
    },
  )

  it('fails closed for missing, future, draft and empty category targets', async () => {
    const reference = { relationTo: 'products', value: 'target' }
    redirects.mockResolvedValue([{ from: '/products/old', to: { reference } }])
    for (const target of [
      null,
      { slug: 'tea', categorySlug: 'green', _status: 'draft', publishedAt: '2020-01-01' },
      { slug: 'tea', categorySlug: 'green', _status: 'published', publishedAt: '2099-01-01' },
    ]) {
      findByID.mockResolvedValue(target)
      await expect(PayloadRedirects({ url: '/products/old' })).rejects.toThrow('NOT_FOUND')
      await expect(
        PayloadRedirects({ url: '/products/old', disableNotFound: true }),
      ).resolves.toBeNull()
    }
    reference.relationTo = 'product-categories'
    findByID.mockResolvedValue({ id: 'target', slug: 'tea' })
    find.mockResolvedValue({ docs: [] })
    await expect(PayloadRedirects({ url: '/products/old' })).rejects.toThrow('NOT_FOUND')
    await expect(
      PayloadRedirects({ url: '/products/old', disableNotFound: true }),
    ).resolves.toBeNull()
    expect(redirect).not.toHaveBeenCalled()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })

  it.each(['products', 'product-categories'] as const)(
    'does not redirect a %s target to itself',
    async (relationTo) => {
      const url = relationTo === 'products' ? '/products/green/tea' : '/products/tea'
      redirects.mockResolvedValue([
        { from: url, to: { reference: { relationTo, value: 'target' } } },
      ])
      findByID.mockResolvedValue({
        id: 'target',
        slug: 'tea',
        categorySlug: 'green',
        _status: 'published',
        publishedAt: '2020-01-01',
      })
      find.mockResolvedValue({ docs: [{ id: 'visible' }] })
      await expect(PayloadRedirects({ url })).rejects.toThrow('NOT_FOUND')
      await expect(PayloadRedirects({ url, disableNotFound: true })).resolves.toBeNull()
      expect(redirect).not.toHaveBeenCalled()
      expect(permanentRedirect).not.toHaveBeenCalled()
    },
  )
})
