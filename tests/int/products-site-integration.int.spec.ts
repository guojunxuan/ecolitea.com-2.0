import { beforeEach, describe, expect, it, vi } from 'vitest'

const { find, findByID } = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn() }))
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
import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'

beforeEach(() => {
  find.mockReset()
  findByID.mockReset()
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

  it('indexes product excerpt, first gallery image, category and visibility date', async () => {
    findByID.mockResolvedValue({ id: 'cat', title: 'Green', slug: 'green' })
    const result = await beforeSyncWithSearch({
      req: { payload: { findByID } },
      originalDoc: {
        slug: 'tea',
        title: 'Tea',
        excerpt: 'Fresh',
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
        { 'doc.relationTo': { equals: 'posts' } },
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

  it.each(['products', 'product-categories'] as const)(
    'returns actual HTTP 301 for %s to the current stable reference',
    async (relationTo) => {
      find.mockImplementation(async ({ collection }) => ({
        docs:
          collection === 'redirects'
            ? [
                {
                  type: '301',
                  from: '/products/old',
                  to: {
                    type: 'reference',
                    reference: {
                      relationTo,
                      value: { id: 'target', slug: 'stale', categorySlug: 'stale' },
                    },
                  },
                },
              ]
            : [{ id: 'visible' }],
      }))
      findByID.mockResolvedValue({
        id: 'target',
        slug: 'tea',
        categorySlug: 'green',
        _status: 'published',
        publishedAt: '2020-01-01',
      })
      const response = await proxy(new NextRequest('https://example.test/products/old'))
      expect(response.status).toBe(301)
      expect(response.headers.get('location')).toBe(
        `https://example.test/products/${relationTo === 'products' ? 'green/tea' : 'tea'}`,
      )
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
      expect(
        (await proxy(new NextRequest('https://example.test/products/old'))).headers.get('location'),
      ).toContain('renamed')
    },
  )

  it('does not expose missing, future or draft targets, empty categories, or redirect to itself', async () => {
    const redirect = {
      type: '301',
      from: '/products/old',
      to: { reference: { relationTo: 'products', value: 'target' } },
    }
    find.mockResolvedValue({ docs: [redirect] })
    for (const target of [
      null,
      { slug: 'tea', categorySlug: 'green', _status: 'draft', publishedAt: '2020-01-01' },
      { slug: 'tea', categorySlug: 'green', _status: 'published', publishedAt: '2099-01-01' },
    ]) {
      findByID.mockResolvedValue(target)
      expect(
        (await proxy(new NextRequest('https://example.test/products/old'))).headers.get('location'),
      ).toBeNull()
    }
    redirect.to.reference.relationTo = 'product-categories'
    findByID.mockResolvedValue({ id: 'target', slug: 'old' })
    find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'redirects' ? [redirect] : [],
    }))
    expect(
      (await proxy(new NextRequest('https://example.test/products/old'))).headers.get('location'),
    ).toBeNull()
    find.mockResolvedValue({ docs: [redirect] })
    expect(
      (await proxy(new NextRequest('https://example.test/products/old'))).headers.get('location'),
    ).toBeNull()
  })
})
