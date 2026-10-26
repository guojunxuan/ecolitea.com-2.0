import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  category: vi.fn(),
  listing: vi.fn(),
  product: vi.fn(),
  related: vi.fn(),
  hero: vi.fn(),
  seo: vi.fn(),
  actions: vi.fn(),
  draft: vi.fn(),
}))
vi.mock('@/utilities/products/getProductCategoriesOverview', () => ({
  getProductCategoriesOverview: mocks.overview,
}))
vi.mock('@/utilities/products/getProductCategoryBySlug', () => ({
  getProductCategoryBySlug: mocks.category,
}))
vi.mock('@/utilities/products/getProductListing', () => ({ getProductListing: mocks.listing }))
vi.mock('@/utilities/products/getProductBySlug', () => ({ getProductBySlug: mocks.product }))
vi.mock('@/utilities/products/getRelatedProducts', () => ({ getRelatedProducts: mocks.related }))
vi.mock('@/utilities/products/getProductListingHero', () => ({ getProductListingHero: mocks.hero }))
vi.mock('@/utilities/products/getProductListingSEO', () => ({ getProductListingSEO: mocks.seo }))
vi.mock('@/utilities/products/getDefaultInquiryButtons', () => ({
  getDefaultInquiryButtons: mocks.actions,
}))
vi.mock('@/utilities/products/getProductStaticParams', () => ({
  getProductStaticParams: async () => ({ categories: [], products: [] }),
}))
vi.mock('next/headers', () => ({ draftMode: mocks.draft }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('404')
  },
  useRouter: () => ({}),
}))
vi.mock('@/components/PayloadRedirects', () => ({ PayloadRedirects: () => null }))
vi.mock('@/heros/HeaderThemeSync', () => ({ HeaderThemeSync: () => null }))
vi.mock('@/heros/BlogListingHero', () => ({
  BlogListingHero: ({ heading }: { heading: string }) => <h1>{heading}</h1>,
}))
vi.mock('@/components/Media', () => ({ Media: () => null }))
vi.mock('@/components/LivePreviewListener', () => ({
  LivePreviewListener: () => <span>Preview listener</span>,
}))
vi.mock('@/collections/Products/blocks/RenderProductBlocks', () => ({
  RenderProductBlocks: () => <span>Block content</span>,
}))
vi.mock('@/components/Products/AnchorNav', () => ({ AnchorNav: () => null }))
vi.mock('@/components/Products/OverflowCarousel', () => ({
  OverflowCarousel: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}))
vi.mock('@/components/Products/ProductGallery', () => ({ ProductGallery: () => null }))
vi.mock('@/components/Products/MobileInquiryBar', () => ({ MobileInquiryBar: () => null }))
import Overview, { generateMetadata as overviewMetadata } from '@/app/(frontend)/products/page'
import {
  parsePageNumber,
  renderProductListing,
  productListingMetadata,
} from '@/app/(frontend)/products/[category]/listing'
import Detail, {
  generateMetadata as detailMetadata,
} from '@/app/(frontend)/products/[category]/[product]/page'
const category = {
  id: 'tea',
  slug: 'tea',
  title: 'Tea bags',
  description: 'Tea packaging',
  image: null,
  meta: { image: null },
}
const cards = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  slug: `bag-${i}`,
  title: `Bag ${i}`,
  categorySlug: 'tea',
  cover: null,
  summary: 'Summary',
}))
const detail = {
  id: 'p',
  title: 'Bag',
  slug: 'bag',
  categorySlug: 'tea',
  category,
  meta: { image: null },
  summary: 'Summary',
  gallery: [],
  options: [],
  specifications: [],
  defaultSelection: {},
  inquiry: { buttons: [] },
  highlights: [],
  sections: [{ anchor: 'features', label: 'Hidden label', blocks: [] }],
  relatedProducts: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.overview.mockResolvedValue([])
  mocks.category.mockResolvedValue(category)
  mocks.listing.mockResolvedValue({ docs: cards, totalPages: 1, page: 1 })
  mocks.product.mockResolvedValue(detail)
  mocks.related.mockResolvedValue([])
  mocks.hero.mockResolvedValue(null)
  mocks.seo.mockResolvedValue({ title: 'Our Products', description: 'Discover products' })
  mocks.actions.mockResolvedValue([])
  mocks.draft.mockResolvedValue({ isEnabled: false })
})
afterEach(cleanup)
describe('Products routes', () => {
  it('renders empty overview without category nav', async () => {
    render(await Overview())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Our Products')
    expect(screen.getByText('No products yet.')).toBeTruthy()
  })
  it.each([6, 8])('overview with %s products uses six cards or five and More', async (count) => {
    mocks.overview.mockResolvedValue([
      { ...category, productCount: count, products: cards, moreCovers: [] },
    ])
    render(await Overview())
    expect(screen.queryByRole('heading', { name: 'Bag 5' })).toBe(
      count === 6 ? screen.getByRole('heading', { name: 'Bag 5' }) : null,
    )
    if (count > 6) {
      expect(screen.getByText('+3')).toBeTruthy()
      expect(screen.getByText('View all 8')).toBeTruthy()
    }
  })
  it('rejects page one aliases, malformed and unsafe page numbers', () => {
    for (const value of ['1', '0', '-1', '02', '2x', '9007199254740992'])
      expect(() => parsePageNumber(value)).toThrow('404')
    expect(parsePageNumber('2')).toBe(2)
  })
  it('hides single page pagination and empty Explore', async () => {
    render(await renderProductListing({ categorySlug: 'tea', page: 1 }))
    expect(screen.queryByRole('navigation', { name: 'pagination' })).toBeNull()
    expect(screen.queryByText('Explore other ranges')).toBeNull()
  })
  it('404s missing categories and out-of-range pages', async () => {
    mocks.category.mockResolvedValue(null)
    expect((await renderProductListing({ categorySlug: 'missing', page: 1 })).props.url).toBe(
      '/products/missing',
    )
    mocks.category.mockResolvedValue(category)
    await expect(renderProductListing({ categorySlug: 'tea', page: 2 })).rejects.toThrow('404')
  })
  it('404s detail category mismatches without redirecting', async () => {
    await expect(
      Detail({ params: Promise.resolve({ category: 'other', product: 'bag' }) }),
    ).rejects.toThrow('404')
  })
  it('does not render section labels or empty Related and specifications', async () => {
    render(await Detail({ params: Promise.resolve({ category: 'tea', product: 'bag' }) }))
    expect(screen.queryByText('Hidden label')).toBeNull()
    expect(screen.queryByText('You may also need')).toBeNull()
    expect(screen.queryByText('Specifications')).toBeNull()
    expect(screen.getByText('Block content')).toBeTruthy()
  })
  it('uses draft lookup and live preview listener', async () => {
    mocks.draft.mockResolvedValue({ isEnabled: true })
    render(await Detail({ params: Promise.resolve({ category: 'tea', product: 'bag' }) }))
    expect(mocks.product).toHaveBeenCalledWith('bag', { draft: true })
    expect(screen.getByText('Preview listener')).toBeTruthy()
  })
  it('provides overview twitter and paginated category canonicals without twitter', async () => {
    expect(await overviewMetadata()).toHaveProperty('twitter')
    const metadata = await productListingMetadata({ categorySlug: 'tea', page: 2 })
    expect(metadata.twitter).toBeNull()
    expect(metadata.alternates?.canonical).toBe('/products/tea/page/2')
    expect(metadata.title).toContain('Page 2')
    expect(metadata.description).toContain('Page 2')
  })
  it('provides detail canonical without twitter and draft noindex', async () => {
    mocks.draft.mockResolvedValue({ isEnabled: true })
    const metadata = await detailMetadata({
      params: Promise.resolve({ category: 'tea', product: 'bag' }),
    })
    expect(metadata.twitter).toBeNull()
    expect(metadata.alternates?.canonical).toBe('/products/tea/bag')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
})
