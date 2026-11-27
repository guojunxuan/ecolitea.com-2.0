import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ product: vi.fn(), actions: vi.fn(), connection: vi.fn() }))
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: false }) }))
vi.mock('next/server', () => ({ connection: mocks.connection }))
vi.mock('@/utilities/products/getProductBySlug', () => ({ getProductBySlug: mocks.product }))
vi.mock('@/utilities/products/getRelatedProducts', () => ({ getRelatedProducts: async () => [] }))
vi.mock('@/utilities/products/getProductStaticParams', () => ({ getProductStaticParams: vi.fn() }))
vi.mock('@/components/PayloadRedirects', () => ({ PayloadRedirects: () => null }))
vi.mock('@/components/LivePreviewListener', () => ({ LivePreviewListener: () => null }))
vi.mock('@/heros/HeaderThemeSync', () => ({ HeaderThemeSync: () => null }))
vi.mock('@/components/Products/ProductGallery', () => ({ ProductGallery: () => null }))
vi.mock('@/components/Products/ProductTabs', () => ({ ProductTabs: () => null }))
vi.mock('@/components/Products/ProductDetailNav', () => ({ ProductDetailNav: () => null }))
vi.mock('@/components/Products/ProductActions', () => ({ ProductActions: mocks.actions }))

import Detail from '@/app/(frontend)/[lang]/products/[category]/[product]/page'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('Quote request product presentation boundary', () => {
  it.each([true, false])(
    'passes normalized display data (has media and category: %s)',
    async (hasMedia) => {
      const first = {
        id: 'first',
        url: '/first.jpg',
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
      }
      mocks.product.mockResolvedValue({
        id: 'bag',
        title: 'Paper Bag',
        slug: 'bag',
        categorySlug: 'packaging',
        category: hasMedia ? { title: 'Packaging' } : null,
        gallery: hasMedia ? [first, { id: 'second', url: '/second.jpg' }] : [],
        overview: [],
        specifications: [],
        downloads: [],
        sections: [],
      })
      mocks.actions.mockReturnValue(null)
      for (const siteKey of ['first-request-key', 'second-request-key', undefined]) {
        // Update the env only when the request boundary resolves, after the page module loaded.
        vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'stale-key')
        mocks.connection.mockImplementationOnce(async () => {
          vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', siteKey)
        })
        render(
          await Detail({
            params: Promise.resolve({ lang: 'en', category: 'packaging', product: 'bag' }),
          }),
        )
        expect(mocks.actions).toHaveBeenLastCalledWith(
          expect.objectContaining({
            siteKey,
            product: {
              title: 'Paper Bag',
              slug: 'bag',
              categoryTitle: hasMedia ? 'Packaging' : undefined,
              thumbnail: hasMedia ? first : undefined,
            },
          }),
          undefined,
        )
        cleanup()
      }
    },
  )
})
