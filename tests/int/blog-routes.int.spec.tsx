import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { find, getBlogListing, getBlogListingHero, getBlogListingSEO, notFound, unstableCache } = vi.hoisted(() => ({
  find: vi.fn(),
  getBlogListing: vi.fn(),
  getBlogListingHero: vi.fn(),
  getBlogListingSEO: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  unstableCache: vi.fn((fn: () => unknown) => async () => JSON.parse(JSON.stringify(await fn()))),
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }))
vi.mock('@/utilities/blogs/getBlogListing', () => ({ getBlogListing }))
vi.mock('@/utilities/blogs/getBlogListingHero', () => ({ getBlogListingHero }))
vi.mock('@/utilities/blogs/getBlogListingSEO', () => ({ getBlogListingSEO }))
vi.mock('@/heros/HeaderThemeSync', () => ({ HeaderThemeSync: () => null }))
vi.mock('@/components/Pagination', () => ({
  Pagination: ({ routeBase, firstPageHref }: { routeBase: string; firstPageHref?: string }) => (
    <span data-route-base={routeBase} data-first-page-href={firstPageHref} />
  ),
}))

import BlogsPage, { generateMetadata as blogsMetadata } from '@/app/(frontend)/blogs/page'
import BlogPage, {
  generateMetadata as pageMetadata,
} from '@/app/(frontend)/blogs/page/[pageNumber]/page'
import CategoryPage, {
  generateMetadata as categoryMetadata,
  generateStaticParams,
} from '@/app/(frontend)/blogs/category/[categorySlug]/page'
import CategoryPaged, {
  generateMetadata as categoryPagedMetadata,
} from '@/app/(frontend)/blogs/category/[categorySlug]/page/[pageNumber]/page'

const categories = [
  { id: 'tea', title: 'Tea Guides', slug: 'tea-guides', description: 'Tea category description' },
  { id: 'life', title: 'Lifestyle', slug: 'lifestyle', description: 'Life category description' },
  { id: 'empty', title: 'Empty', slug: 'empty' },
]
const blog = (index: number, category = 'tea') => ({
  id: `blog-${index}`,
  slug: `blog-${index}`,
  title: `Blog ${index}`,
  excerpt: 'Excerpt',
  category,
  heroImage: 'media',
  publishedAt: '2026-09-01T00:00:00.000Z',
})

beforeEach(() => {
  vi.useRealTimers()
  find.mockReset()
  getBlogListing.mockReset()
  getBlogListingHero.mockReset().mockResolvedValue(null)
  getBlogListingSEO.mockReset().mockResolvedValue({})
  notFound.mockClear()
  find.mockImplementation(
    async ({
      collection,
      where,
      page,
    }: {
      collection: string
      where?: { slug?: { equals: string } }
      page?: number
    }) => {
      if (collection === 'blog-categories' && where?.slug)
        return { docs: categories.filter(({ slug }) => slug === where.slug?.equals) }
      if (collection === 'blog-categories') return { docs: categories, hasNextPage: false }
      if (collection === 'blogs')
        return {
          docs:
            page === 2
              ? [
                  blog(13),
                  blog(14, 'life'),
                  ...(categories.some(({ id }) => id === 'new') ? [blog(15, 'new')] : []),
                ]
              : Array.from({ length: 12 }, (_, index) => blog(index + 1)),
          hasNextPage: page === 1,
        }
      throw new Error(`Unexpected collection ${collection}`)
    },
  )
  getBlogListing.mockImplementation(async (page: number, categoryId?: string) => ({
    docs: Array.from({ length: page === 1 ? 12 : 1 }, (_, index) =>
      blog(page === 1 ? index + 1 : 13),
    ),
    page,
    totalDocs: categoryId ? 13 : 25,
    totalPages: categoryId ? 2 : 3,
  }))
})

describe('blog listing routes', () => {
  it('keeps all four listing routes static with ten-minute revalidation', async () => {
    const routes = await Promise.all([
      import('@/app/(frontend)/blogs/page'),
      import('@/app/(frontend)/blogs/page/[pageNumber]/page'),
      import('@/app/(frontend)/blogs/category/[categorySlug]/page'),
      import('@/app/(frontend)/blogs/category/[categorySlug]/page/[pageNumber]/page'),
    ])
    for (const route of routes) {
      expect(route.dynamic).toBe('force-static')
      expect(route.revalidate).toBe(600)
    }
  })
  it('renders first page with counts from all visible blogs, ordered nonempty tabs, 12 cards and featured item', async () => {
    const html = renderToStaticMarkup(await BlogsPage())
    expect(html).toContain('<h1')
    expect(html).toContain('Blogs')
    expect(html).toContain('Showing 1 - 12 of 25 Blogs')
    expect(html.match(/data-slot="archive-item"/g) || []).toHaveLength(12)
    expect(html.match(/data-featured="true"/g) || []).toHaveLength(1)
    expect(html).toContain('data-route-base="/blogs"')
    expect(html).toContain('data-first-page-href="/blogs"')
    expect(html.indexOf('Tea Guides')).toBeLessThan(html.indexOf('Lifestyle'))
    expect(html).not.toContain('>Empty <')
    expect(html).toContain('Tea Guides <span')
    expect(html).toContain('13</span>')
    expect(
      find.mock.calls.filter(([args]) => args.collection === 'blogs' && args.select?.category),
    ).toHaveLength(2)
    expect(unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Array),
      expect.objectContaining({ tags: expect.arrayContaining(['blogs-list', 'blog-categories']) }),
    )
  })

  it('renders later unfiltered pages without a featured card', async () => {
    const html = renderToStaticMarkup(
      await BlogPage({ params: Promise.resolve({ pageNumber: '2' }) }),
    )
    expect(html).not.toContain('data-featured="true"')
    expect(html).toContain('Showing 13 - 13 of 25 Blogs')
    expect(getBlogListing).toHaveBeenCalledWith(2, undefined)
  })

  it.each([1, 2])('renders the managed Hero on unfiltered page %s', async (page) => {
    getBlogListingHero.mockResolvedValue({
      heading: 'Stories from our tea community',
      description: 'Discover tea stories and ideas.',
      headerTheme: 'light',
    })
    const html = renderToStaticMarkup(
      page === 1
        ? await BlogsPage()
        : await BlogPage({ params: Promise.resolve({ pageNumber: '2' }) }),
    )
    expect(html.match(/<h1[^>]*>Stories from our tea community<\/h1>/g) || []).toHaveLength(1)
    expect(html.match(/<h1\b/g) || []).toHaveLength(1)
    expect(html).not.toMatch(/<h1[^>]*>Blogs<\/h1>/)
    expect(html).toContain('Discover tea stories and ideas.')
    expect(html).toContain('Tea Guides <span')
    expect(html.match(/data-slot="archive-item"/g) || []).toHaveLength(page === 1 ? 12 : 1)
    expect(html.indexOf('data-hero="blog-listing"')).toBeLessThan(html.indexOf('Tea Guides <span'))
    expect(getBlogListingHero).toHaveBeenCalledTimes(1)
  })

  it.each([1, 2])(
    'keeps the default heading when the Hero adapter returns null on page %s',
    async (page) => {
      const html = renderToStaticMarkup(
        page === 1
          ? await BlogsPage()
          : await BlogPage({ params: Promise.resolve({ pageNumber: '2' }) }),
      )
      expect(html).toMatch(/<h1[^>]*>Blogs<\/h1>/)
      expect(html).not.toContain('data-hero="blog-listing"')
      expect(getBlogListingHero).toHaveBeenCalledTimes(1)
    },
  )

  it('counts visible blogs across Payload result pages', async () => {
    find.mockImplementation(async ({ collection, page }: { collection: string; page?: number }) => {
      if (collection === 'blog-categories') return { docs: categories, hasNextPage: false }
      if (collection === 'blogs')
        return {
          docs:
            page === 1 ? Array.from({ length: 100 }, (_, index) => blog(index + 1)) : [blog(101)],
          hasNextPage: page === 1,
        }
      throw new Error(`Unexpected collection ${collection}`)
    })
    const html = renderToStaticMarkup(await BlogsPage())
    expect(html).toContain('Tea Guides <span')
    expect(html).toContain('101</span>')
    expect(
      find.mock.calls
        .filter(([args]) => args.collection === 'blogs' && args.select?.category)
        .map(([args]) => args.page),
    ).toEqual([1, 2])
  })

  it('renders category breadcrumb, description, active tab and category pagination base', async () => {
    const html = renderToStaticMarkup(
      await CategoryPage({ params: Promise.resolve({ categorySlug: 'tea-guides' }) }),
    )
    expect(html).toContain('Tea Guides')
    expect(html).toContain('Tea category description')
    expect(html).toContain('href="/blogs"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('data-route-base="/blogs/category/tea-guides"')
    expect(html).toContain('data-first-page-href="/blogs/category/tea-guides"')
    expect(html).not.toContain('data-featured="true"')
    expect(getBlogListing).toHaveBeenCalledWith(1, 'tea')
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toMatch(/<h1[^>]*>Tea Guides Blogs<\/h1>/)
    expect(getBlogListingHero).not.toHaveBeenCalled()
  })

  it('renders a later category page through the same listing flow', async () => {
    const html = renderToStaticMarkup(
      await CategoryPaged({
        params: Promise.resolve({ categorySlug: 'tea-guides', pageNumber: '2' }),
      }),
    )
    expect(html).toContain('data-route-base="/blogs/category/tea-guides"')
    expect(getBlogListing).toHaveBeenCalledWith(2, 'tea')
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toMatch(/<h1[^>]*>Tea Guides Blogs<\/h1>/)
    expect(getBlogListingHero).not.toHaveBeenCalled()
  })

  it.each(['0', '-1', '1', '2.5', '2e1', '02', 'abc', 'Infinity'])(
    'rejects noncanonical page %s',
    async (pageNumber) => {
      await expect(BlogPage({ params: Promise.resolve({ pageNumber }) })).rejects.toThrow(
        'NEXT_NOT_FOUND',
      )
      expect(getBlogListing).not.toHaveBeenCalled()
    },
  )

  it('rejects out-of-range pages and unknown categories', async () => {
    await expect(BlogPage({ params: Promise.resolve({ pageNumber: '4' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    await expect(
      CategoryPage({ params: Promise.resolve({ categorySlug: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(
      CategoryPaged({ params: Promise.resolve({ categorySlug: 'missing', pageNumber: '2' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(
      CategoryPaged({ params: Promise.resolve({ categorySlug: 'tea-guides', pageNumber: '3' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('rejects categories without visible blogs, including their page one route', async () => {
    await expect(
      CategoryPage({ params: Promise.resolve({ categorySlug: 'empty' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(
      CategoryPaged({ params: Promise.resolve({ categorySlug: 'empty', pageNumber: '2' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('uses distinct metadata and canonical paths for all four routes', async () => {
    const all = await blogsMetadata()
    const later = await pageMetadata({ params: Promise.resolve({ pageNumber: '2' }) })
    const category = await categoryMetadata({
      params: Promise.resolve({ categorySlug: 'tea-guides' }),
    })
    const categoryLater = await categoryPagedMetadata({
      params: Promise.resolve({ categorySlug: 'tea-guides', pageNumber: '2' }),
    })
    expect([all, later, category, categoryLater].map(({ title }) => title)).toEqual([
      'Blogs',
      'Blogs — Page 2',
      'Tea Guides Blogs',
      'Tea Guides Blogs — Page 2',
    ])
    expect(
      [all, later, category, categoryLater].map(({ alternates }) => alternates?.canonical),
    ).toEqual([
      '/blogs',
      '/blogs/page/2',
      '/blogs/category/tea-guides',
      '/blogs/category/tea-guides/page/2',
    ])
    expect(category.description).toContain('Tea category description')
    expect(all.description).toBeTruthy()
    expect(later.description).not.toBe(all.description)
  })

  it('uses Settings SEO for unfiltered listings while preserving page-specific canonical URLs', async () => {
    getBlogListingSEO.mockResolvedValue({
      title: 'Tea stories',
      description: 'Fresh notes from the tea world.',
      imageURL: 'https://media.example.invalid/blog-share.png',
    })
    const first = await blogsMetadata()
    const second = await pageMetadata({ params: Promise.resolve({ pageNumber: '2' }) })
    expect(first).toMatchObject({
      title: 'Tea stories',
      description: 'Fresh notes from the tea world.',
      alternates: { canonical: '/blogs' },
      openGraph: {
        title: 'Tea stories',
        description: 'Fresh notes from the tea world.',
        url: '/blogs',
        images: [{ url: 'https://media.example.invalid/blog-share.png' }],
      },
      twitter: {
        title: 'Tea stories',
        description: 'Fresh notes from the tea world.',
        images: ['https://media.example.invalid/blog-share.png'],
      },
    })
    expect(second).toMatchObject({
      title: 'Tea stories — Page 2',
      description: 'Fresh notes from the tea world. Page 2.',
      alternates: { canonical: '/blogs/page/2' },
      openGraph: { title: 'Tea stories — Page 2', url: '/blogs/page/2' },
      twitter: { title: 'Tea stories — Page 2' },
    })
    expect(getBlogListingSEO).toHaveBeenCalledTimes(2)
    expect(getBlogListingHero).not.toHaveBeenCalled()
  })

  it('keeps category metadata independent from Settings SEO', async () => {
    getBlogListingSEO.mockResolvedValue({ title: 'Settings title' })
    const category = await categoryMetadata({ params: Promise.resolve({ categorySlug: 'tea-guides' }) })
    expect(category.title).toBe('Tea Guides Blogs')
    expect(category.description).toBe('Tea category description')
    expect(getBlogListingSEO).not.toHaveBeenCalled()
  })

  it('prerenders only populated categories while allowing new populated categories at request time', async () => {
    expect(await generateStaticParams()).toEqual([
      { categorySlug: 'tea-guides' },
      { categorySlug: 'lifestyle' },
    ])
    categories.push({
      id: 'new',
      title: 'New',
      slug: 'new',
      description: 'New category description',
    })
    const html = renderToStaticMarkup(
      await CategoryPage({ params: Promise.resolve({ categorySlug: 'new' }) }),
    )
    expect(html).toContain('New category description')
    categories.pop()
  })
})
