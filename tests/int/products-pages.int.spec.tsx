import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Props as MediaProps } from '@/components/Media/types'
vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => ({ publicLocales: [{ code: 'en' }] }),
}))
const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  category: vi.fn(),
  listing: vi.fn(),
  product: vi.fn(),
  related: vi.fn(),
  hero: vi.fn(),
  seo: vi.fn(),
  carousel: vi.fn(),
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
vi.mock('@/utilities/products/getProductCategoryCarousel', () => ({
  getProductCategoryCarousel: mocks.carousel,
}))
vi.mock('@/utilities/products/getProductStaticParams', () => ({
  getProductStaticParams: async () => ({ categories: [], products: [] }),
}))
vi.mock('next/headers', () => ({ draftMode: mocks.draft }))
// Metadata reads the brand from cached Site Settings; keep it out of these route tests.
vi.mock('@/utilities/siteIdentity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/siteIdentity')>()),
  getSiteIdentity: async () => ({ siteName: 'Test Site' }),
}))
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
vi.mock('@/components/Media', () => ({
  Media: ({ resource, presentation }: MediaProps) =>
    resource && typeof resource === 'object' ? (
      <span role="img" aria-label={resource.alt || ''} data-fit={presentation?.image?.fit} />
    ) : null,
}))
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
import Overview, {
  generateMetadata as overviewMetadata,
} from '@/app/(frontend)/[lang]/products/page'
import {
  parsePageNumber,
  renderProductListing,
  productListingMetadata,
} from '@/app/(frontend)/[lang]/products/[category]/listing'
import Detail, {
  generateMetadata as detailMetadata,
} from '@/app/(frontend)/[lang]/products/[category]/[product]/page'
const category = {
  id: 'tea',
  slug: 'tea',
  title: 'Tea bags',
  description: 'Tea packaging',
  image: null,
  imageFit: 'cover',
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
  overview: ['Summary'],
  specifications: [],
  downloads: [],
  sections: [
    {
      anchor: 'features',
      label: 'Hidden label',
      theme: 'default',
      title: null,
      description: null,
      blocks: [],
    },
  ],
  relatedProducts: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  mocks.overview.mockResolvedValue([])
  mocks.category.mockResolvedValue(category)
  mocks.listing.mockResolvedValue({ docs: cards, totalPages: 1, page: 1 })
  mocks.product.mockResolvedValue(detail)
  mocks.related.mockResolvedValue([])
  mocks.hero.mockResolvedValue([])
  mocks.carousel.mockResolvedValue([])
  mocks.seo.mockResolvedValue({ title: 'Our Products', description: 'Discover products' })
  mocks.draft.mockResolvedValue({ isEnabled: false })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('Products routes', () => {
  it('renders empty overview without category nav', async () => {
    render(await Overview({ params: Promise.resolve({ lang: 'en' }) }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Our Products')
    expect(screen.getByText('No products yet.')).toBeTruthy()
  })
  it.each(['Our Products', ''])(
    'keeps one persistent SEO h1 (%s) with media-only slides before the product sections',
    async (seoTitle) => {
      mocks.seo.mockResolvedValue({ title: seoTitle, description: 'Discover products' })
      mocks.overview.mockResolvedValue([{ ...category, productCount: 6, products: cards }])
      mocks.hero.mockResolvedValue([
        {
          id: 'slide',
          title: 'Featured range',
          media: null,
          theme: 'light',
          cta: { type: 'custom', url: '/contact', label: 'Discover' },
        },
      ])
      mocks.carousel.mockResolvedValue([
        { id: 'tea', title: 'Tea bags', href: '/products/tea', image: null },
      ])
      render(await Overview({ params: Promise.resolve({ lang: 'en' }) }))
      const headings = screen.getAllByRole('heading', { level: 1 })
      expect(headings).toHaveLength(1)
      expect(headings[0].textContent).toBe(seoTitle || 'Products')
      expect(headings[0].closest('[aria-roledescription="slide"]')).toBeNull()
      expect(screen.queryByRole('heading', { level: 2, name: 'Featured range' })).toBeNull()
      expect(screen.getByRole('link', { name: 'Discover' }).getAttribute('href')).toBe('/contact')
      expect(screen.getByRole('link', { name: 'Tea bags' }).getAttribute('href')).toBe(
        '/products/tea',
      )
      expect(document.getElementById('tea')).toBeTruthy()
    },
  )
  it('applies the inverse theme to the dark product hero slide itself', async () => {
    mocks.hero.mockResolvedValue([
      { id: 'dark', title: 'Featured range', media: null, theme: 'dark', showText: true },
    ])
    render(await Overview({ params: Promise.resolve({ lang: 'en' }) }))
    const slide = screen.getByRole('heading', { name: 'Featured range' }).closest(
      '[aria-roledescription="slide"]',
    )
    expect(slide?.getAttribute('data-website-theme')).toBe('inverse')
  })

  it.each([1, 2, 3, 4, 6, 8])(
    'overview with %s products previews the latest four and a category entry',
    async (count) => {
      mocks.overview.mockResolvedValue([
        { ...category, productCount: count, products: cards.slice(0, count) },
      ])
      render(await Overview({ params: Promise.resolve({ lang: 'en' }) }))
      const section = screen.getByRole('region', { name: 'Tea bags' })
      expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe('Tea bags')
      expect(within(section).getByText('Tea packaging')).toBeTruthy()
      expect(within(section).getByText('Latest Products')).toBeTruthy()
      const more = within(section).getByRole('link', { name: 'View More' })
      expect(more.getAttribute('href')).toBe('/products/tea')
      expect(more.querySelector('svg')).toBeNull()
      const list = within(section).getByRole('list')
      const items = within(list).getAllByRole('listitem')
      expect(items).toHaveLength(Math.min(count, 4) + (count > 3 ? 1 : 0))
      expect(
        items
          .slice(0, Math.min(count, 4))
          .map((item) => within(item).getByRole('heading').textContent),
      ).toEqual(cards.slice(0, Math.min(count, 4)).map((card) => card.title))
      expect(within(items[0]).getByRole('link').getAttribute('href')).toBe('/products/tea/bag-0')
      expect(within(list).getAllByRole('link')).toHaveLength(items.length)
      for (const item of items.slice(0, Math.min(count, 4))) {
        const productLink = within(item).getByRole('link')
        expect(within(productLink).getByText('View More')).toBeTruthy()
        expect(productLink.querySelector('a, button')).toBeNull()
      }
      const categoryEntry = within(list).queryByRole('link', { name: 'View More · Tea bags' })
      if (count > 3) {
        expect(categoryEntry?.getAttribute('href')).toBe('/products/tea')
        expect(categoryEntry?.textContent).toBe('View More')
      } else expect(categoryEntry).toBeNull()
      expect(screen.queryByText(/^View all/)).toBeNull()
      expect(screen.queryByText(/^\+\d+$/)).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Bag 4' })).toBeNull()
    },
  )
  it.each([
    { width: 1600, height: 900, fit: 'cover' },
    { width: 600, height: 600, fit: 'contain' },
    { width: undefined, height: undefined, fit: 'cover' },
  ])('renders category media using the shared renderer ($fit, $width × $height)', async (image) => {
    mocks.overview.mockResolvedValue([
      {
        ...category,
        image: {
          id: 'category-image',
          alt: 'Tea category cover',
          width: image.width,
          height: image.height,
        },
        imageFit: image.fit,
        productCount: 6,
        products: cards,
      },
    ])
    render(await Overview({ params: Promise.resolve({ lang: 'en' }) }))
    const cover = screen.getByRole('img', { name: 'Tea category cover' })
    expect(cover.getAttribute('data-fit')).toBe(image.fit)
    expect(cover.closest('a')?.getAttribute('href')).toBe('/products/tea')
  })
  it('keeps each category preview separate and usable without a cover or description', async () => {
    mocks.overview.mockResolvedValue([
      { ...category, productCount: 6, products: cards },
      {
        ...category,
        id: 'coffee',
        slug: 'coffee',
        title: 'Coffee bags',
        description: null,
        productCount: 1,
        products: [
          { ...cards[0], id: 'coffee-bag', categorySlug: 'coffee', title: 'Coffee filter' },
        ],
      },
    ])
    render(await Overview({ params: Promise.resolve({ lang: 'en' }) }))
    const tea = screen.getByRole('region', { name: 'Tea bags' })
    const coffee = screen.getByRole('region', { name: 'Coffee bags' })
    expect(tea.id).toBe('tea')
    expect(coffee.id).toBe('coffee')
    expect(within(coffee).getByRole('link', { name: 'View More' }).getAttribute('href')).toBe(
      '/products/coffee',
    )
    expect(within(coffee).queryByRole('img')).toBeNull()
    expect(within(coffee).getAllByRole('listitem')).toHaveLength(1)
    expect(within(tea).queryByText('Coffee filter')).toBeNull()
    expect(within(coffee).queryByRole('heading', { name: 'Bag 0' })).toBeNull()
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
    expect(screen.getAllByText('View More')).toHaveLength(cards.length)
    expect(
      screen.getAllByText('View More').map((action) => action.closest('a')?.getAttribute('href')),
    ).toEqual(cards.map((card) => `/products/tea/${card.slug}`))
  })
  it('uses the same single-link View More action for related product cards', async () => {
    mocks.related.mockResolvedValue([cards[0]])
    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    const related = document.querySelector('[data-product-card]') as HTMLElement
    expect(related).toBeTruthy()
    expect(within(related).getByText('View More').closest('a')).toBe(related)
    expect(related.querySelector('a, button, [role="button"]')).toBeNull()
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
      Detail({ params: Promise.resolve({ lang: 'en', category: 'other', product: 'bag' }) }),
    ).rejects.toThrow('404')
  })
  it('selects Overview when specifications are empty and omits an empty Download action', async () => {
    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    expect(screen.queryByText('Hidden label')).toBeNull()
    expect(screen.queryByText('You may also need')).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Specifications' })).toBeNull()
    const overview = screen.getByRole('tab', { name: 'Overview', selected: true })
    expect(screen.getByRole('tabpanel', { name: 'Overview' }).id).toBe(
      overview.getAttribute('aria-controls'),
    )
    expect(screen.getByText('Summary')).toBeTruthy()
    expect(screen.queryByText('Block content')).toBeNull()
    expect(screen.queryByText(/Download/)).toBeNull()
    const quote = screen.getByRole<HTMLButtonElement>('button', { name: 'Request a quote' })
    expect(quote.disabled).toBe(false)
    expect(quote.getAttribute('aria-haspopup')).toBe('dialog')
  })
  it('selects Overview by default and slides panels in the direction of the selected tab', async () => {
    mocks.product.mockResolvedValue({
      ...detail,
      overview: ['The first paragraph.', 'A second paragraph.'],
      specifications: [{ group: null, items: [{ label: 'Width', value: '60 mm' }] }],
    })
    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Specifications'])
    const overview = screen.getByRole('tab', { name: 'Overview', selected: true })
    const specifications = screen.getByRole('tab', { name: 'Specifications', selected: false })
    expect(specifications.tabIndex).toBe(-1)
    const overviewPanel = screen.getByRole('tabpanel', { name: 'Overview' })
    expect(Array.from(overviewPanel.querySelectorAll('p'), (p) => p.textContent)).toEqual([
      'The first paragraph.',
      'A second paragraph.',
    ])
    const specificationsPanel = document.getElementById(
      specifications.getAttribute('aria-controls')!,
    )!
    expect(overviewPanel.dataset.position).toBe('current')
    expect(specificationsPanel.dataset.position).toBe('after')
    expect(specificationsPanel.hasAttribute('inert')).toBe(true)

    overview.focus()
    fireEvent.keyDown(overview, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(specifications)
    expect(specifications.getAttribute('aria-selected')).toBe('true')
    expect(specifications.tabIndex).toBe(0)
    expect(overview.tabIndex).toBe(-1)
    expect(screen.queryByRole('tabpanel', { name: 'Overview' })).toBeNull()
    expect(screen.getByRole('tabpanel', { name: 'Specifications' }).textContent).toContain('60 mm')
    expect(overviewPanel.dataset.position).toBe('before')
    expect(specificationsPanel.dataset.position).toBe('current')
    expect(specificationsPanel.hasAttribute('inert')).toBe(false)

    fireEvent.keyDown(specifications, { key: 'Home' })
    expect(document.activeElement).toBe(overview)
    fireEvent.keyDown(overview, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(specifications)
    fireEvent.keyDown(specifications, { key: 'Home' })
    fireEvent.keyDown(overview, { key: 'End' })
    expect(document.activeElement).toBe(specifications)
  })
  it('shows the first six specifications across groups and expands the rest in order', async () => {
    mocks.product.mockResolvedValue({
      ...detail,
      specifications: [
        {
          group: 'Materials',
          items: Array.from({ length: 5 }, (_, i) => ({
            label: `Material ${i + 1}`,
            value: 'Paper',
          })),
        },
        {
          group: 'Dimensions',
          items: [
            { label: 'Width', value: '60 mm' },
            { label: 'Height', value: '90 mm' },
          ],
        },
      ],
    })
    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Specifications' }))
    const panel = screen.getByRole('tabpanel', { name: 'Specifications' })
    expect(within(panel).getByRole('heading', { name: 'Materials' })).toBeTruthy()
    expect(within(panel).getByRole('heading', { name: 'Dimensions' })).toBeTruthy()
    expect(within(panel).getByText('Width')).toBeTruthy()
    expect(within(panel).queryByText('Height')).toBeNull()
    const toggle = within(panel).getByRole('button', { name: 'Show all specifications' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(within(panel).getByText('Height')).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(within(panel).queryByText('Height')).toBeNull()
  })
  it('offers to expand Overview only when the copy exceeds five measured lines', async () => {
    let fullHeight = 120
    let measure: ResizeObserverCallback | undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          measure = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    const getComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((node) =>
      Object.assign(getComputedStyle(node), { lineHeight: '24px' }),
    )
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => fullHeight)

    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull()
    fullHeight = 144
    act(() => measure?.([], {} as ResizeObserver))
    const toggle = screen.getByRole('button', { name: 'Read more' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Read less' })).toBe(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fullHeight = 96
    act(() => measure?.([], {} as ResizeObserver))
    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull()
  })
  describe('Download dialog', () => {
    // jsdom has no modal dialog support, so model the open attribute and close event.
    beforeEach(() => {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute('open', '')
      }
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute('open')
        this.dispatchEvent(new Event('close'))
      }
    })
    const files = [
      {
        id: 'spec',
        title: 'Specification sheet',
        url: 'https://files.example.test/spec.pdf',
        mimeType: 'application/pdf',
        filesize: 2_400_000,
      },
      { id: 'sizes', title: 'Size chart', url: '/sizes.xlsx', mimeType: null, filesize: 5_000 },
    ]
    const dialogOf = () =>
      screen.getByRole('heading', { name: 'Resources', hidden: true }).closest('dialog')!

    it('keeps file details out of the button and lists them in a labelled dialog', async () => {
      mocks.product.mockResolvedValue({ ...detail, downloads: files.slice(0, 1) })
      render(
        await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
      )
      const trigger = screen.getByRole('button', { name: 'Download' })
      expect(trigger.textContent).toBe('Download')
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
      expect(dialogOf().hasAttribute('open')).toBe(false)

      fireEvent.click(trigger)
      const dialog = dialogOf()
      expect(dialog.hasAttribute('open')).toBe(true)
      expect(document.documentElement.style.overflow).toBe('hidden')
      expect(dialog.getAttribute('aria-labelledby')).toBe(
        within(dialog).getByRole('heading', { name: 'Resources', hidden: true }).id,
      )
      const link = within(dialog).getByRole('link', { hidden: true })
      expect(link.getAttribute('href')).toBe('https://files.example.test/spec.pdf')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.textContent).toContain('Specification sheet')
      expect(link.textContent).toContain('PDF · 2.4 MB')
    })
    it('lists every file and closes from the Close button, releasing scroll and focus', async () => {
      mocks.product.mockResolvedValue({ ...detail, downloads: files })
      render(
        await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
      )
      const trigger = screen.getByRole('button', { name: 'Download' })
      fireEvent.click(trigger)
      const dialog = dialogOf()
      const links = within(dialog).getAllByRole('link', { hidden: true })
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        'https://files.example.test/spec.pdf',
        '/sizes.xlsx',
      ])
      expect(links[1].textContent).toContain('XLSX · 5 KB')

      fireEvent.click(within(dialog).getByRole('button', { name: 'Close', hidden: true }))
      expect(dialog.hasAttribute('open')).toBe(false)
      expect(document.documentElement.style.overflow).toBe('')
      expect(document.activeElement).toBe(trigger)
    })
    it('closes on a backdrop click but not on a click inside the panel', async () => {
      mocks.product.mockResolvedValue({ ...detail, downloads: files })
      render(
        await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
      )
      fireEvent.click(screen.getByRole('button', { name: 'Download' }))
      const dialog = dialogOf()
      fireEvent.click(within(dialog).getByRole('heading', { name: 'Resources', hidden: true }))
      expect(dialog.hasAttribute('open')).toBe(true)
      fireEvent.click(dialog)
      expect(dialog.hasAttribute('open')).toBe(false)
    })
  })
  it('switches gallery images by thumbnail, keyboard and touch scrolling without changing the URL', async () => {
    const url = window.location.href
    let desktop = true
    vi.stubGlobal('matchMedia', () => ({
      matches: desktop,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    mocks.product.mockResolvedValue({
      ...detail,
      gallery: [
        { id: 'front', alt: 'Front view' },
        { id: 'back', alt: 'Back view' },
      ],
    })
    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    const gallery = screen.getByRole('region', { name: 'Product images' })
    expect(within(gallery).getByRole('img', { name: 'Front view' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show image 2 of 2' }))
    expect(within(gallery).getByRole('img', { name: 'Back view' })).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()
    fireEvent.keyDown(gallery, { key: 'ArrowLeft' })
    expect(within(gallery).getByRole('img', { name: 'Front view' })).toBeTruthy()

    desktop = false
    Object.defineProperty(gallery, 'clientWidth', { value: 200 })
    gallery.scrollLeft = 200
    fireEvent.scroll(gallery)
    expect(within(gallery).getByRole('img', { name: 'Back view' })).toBeTruthy()
    expect(window.location.href).toBe(url)
  })
  it('uses draft lookup and live preview listener', async () => {
    mocks.draft.mockResolvedValue({ isEnabled: true })
    render(
      await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
    )
    expect(mocks.product).toHaveBeenCalledWith('bag', { draft: true, locale: 'en' })
    expect(screen.getByText('Preview listener')).toBeTruthy()
  })
  it('provides overview twitter and paginated category canonicals without twitter', async () => {
    expect(await overviewMetadata({ params: Promise.resolve({ lang: 'en' }) })).toHaveProperty(
      'twitter',
    )
    const metadata = await productListingMetadata({ categorySlug: 'tea', page: 2 })
    expect(metadata.twitter).toBeNull()
    expect(metadata.alternates?.canonical).toBe('/products/tea/page/2')
    expect(metadata.title).toContain('Page 2')
    expect(metadata.description).toContain('Page 2')
  })
  it('provides detail canonical without twitter and draft noindex', async () => {
    mocks.draft.mockResolvedValue({ isEnabled: true })
    const metadata = await detailMetadata({
      params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }),
    })
    expect(metadata.twitter).toBeNull()
    expect(metadata.alternates?.canonical).toBe('/products/tea/bag')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })
  it.each(['', ' \t\n '])('falls back to product text for blank detail SEO %j', async (blank) => {
    mocks.product.mockResolvedValue({
      ...detail,
      meta: { image: null, title: blank, description: blank },
    })
    const metadata = await detailMetadata({
      params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }),
    })
    expect(metadata).toMatchObject({ title: detail.title, description: detail.summary })
    expect(metadata.openGraph).toMatchObject({ title: detail.title, description: detail.summary })
  })
  it('uses trimmed detail SEO overrides when provided', async () => {
    mocks.product.mockResolvedValue({
      ...detail,
      meta: { image: null, title: '  Custom title  ', description: '  Custom description  ' },
    })
    const metadata = await detailMetadata({
      params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }),
    })
    expect(metadata).toMatchObject({ title: 'Custom title', description: 'Custom description' })
    expect(metadata.openGraph).toMatchObject({
      title: 'Custom title',
      description: 'Custom description',
    })
  })
})

it.each([
  { name: 'title and description', title: 'Made with care', description: 'Everyday use' },
  { name: 'title only', title: 'Made with care', description: null },
  { name: 'description only', title: null, description: 'Everyday use' },
  { name: 'neither title nor description', title: null, description: null },
])('uses label only as an accessible fallback with $name', async ({ title, description }) => {
  mocks.product.mockResolvedValue({
    ...detail,
    sections: [
      {
        label: 'Navigation only',
        anchor: 'materials',
        title,
        description,
        theme: 'inverse',
        blocks: [
          {
            blockType: 'productCode',
            label: 'Example',
            html: '<p>Example</p>',
            minHeight: 400,
            width: 'standard',
          },
        ],
      },
    ],
  })
  const { container } = render(
    await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }),
  )
  const section = screen.getByRole('region', { name: title || 'Navigation only' })
  expect(section.getAttribute('data-website-theme')).toBe('inverse')
  expect(screen.queryByText('Navigation only')).toBeNull()
  expect(section.querySelector('.website-type-eyebrow')).toBeNull()
  expect(container.querySelectorAll('h1')).toHaveLength(1)
  if (title) {
    const heading = within(section).getByRole('heading', { level: 2, name: title })
    expect(heading.classList.contains('website-type-heading-1')).toBe(true)
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id)
    expect(section.hasAttribute('aria-label')).toBe(false)
  } else {
    expect(section.getAttribute('aria-label')).toBe('Navigation only')
    expect(section.hasAttribute('aria-labelledby')).toBe(false)
    expect(within(section).queryByRole('heading')).toBeNull()
  }
  if (description)
    expect(within(section).getByText(description).classList.contains('website-type-excerpt')).toBe(
      true,
    )
  if (title || description) {
    expect(section.querySelector('header')).toBeTruthy()
  } else {
    expect(section.querySelector('header')).toBeNull()
    expect(section.firstElementChild?.textContent).toBe('Block content')
  }
})

it.each([
  { name: 'full-bleed block without header', width: 'full', title: null, start: true, end: true },
  {
    name: 'full-bleed block after a header',
    width: 'full',
    title: 'Made with care',
    start: false,
    end: true,
  },
  { name: 'contained block', width: 'standard', title: null, start: false, end: false },
])('marks section edges flush for a $name', async ({ width, title, start, end }) => {
  mocks.product.mockResolvedValue({
    ...detail,
    sections: [
      {
        label: 'Edges',
        anchor: 'edges',
        title,
        description: null,
        theme: 'default',
        blocks: [
          {
            blockType: 'productCode',
            label: 'Example',
            html: '<p>Example</p>',
            minHeight: 400,
            width,
          },
        ],
      },
    ],
  })
  render(await Detail({ params: Promise.resolve({ lang: 'en', category: 'tea', product: 'bag' }) }))
  const section = screen.getByRole('region', { name: title || 'Edges' })
  expect(section.hasAttribute('data-flush-start')).toBe(start)
  expect(section.hasAttribute('data-flush-end')).toBe(end)
})
