import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { find, unstableCache, revalidateTag, revalidatePath } = vi.hoisted(() => ({
  find: vi.fn(),
  unstableCache: vi.fn((fn: () => Promise<unknown>) => fn),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('next/cache', () => ({
  unstable_cache: unstableCache,
  revalidateTag,
  revalidatePath,
}))

const require = createRequire(import.meta.url)
const sitemapConfig = require('../../next-sitemap.config.cjs')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-02T12:00:00.000Z'))
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://blog.example.test')
  find.mockReset()
  unstableCache.mockClear()
  revalidateTag.mockClear()
  revalidatePath.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function sitemapEntries(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  expect(document.querySelector('parsererror')).toBeNull()
  return [...document.querySelectorAll('url')].map((entry) => ({
    loc: entry.querySelector('loc')?.textContent,
    lastmod: entry.querySelector('lastmod')?.textContent,
  }))
}

describe('Blog sitemap', () => {
  it('discovers the dynamic sitemap through robots configuration', () => {
    expect(sitemapConfig.robotsTxtOptions.additionalSitemaps).toContain(
      `${sitemapConfig.siteUrl}/blogs-sitemap.xml`,
    )
    expect(sitemapConfig.exclude).toContain('/blogs-sitemap.xml')
  })

  it('includes the index, ordered populated categories, and only due published articles across pages', async () => {
    find.mockImplementation(async ({ collection, page, where }: { collection: string; page: number; where?: Record<string, unknown> }) => {
      if (collection === 'blog-categories') return {
        docs: page === 1 ? [
          { id: 'tea', slug: 'tea-guides', updatedAt: '2026-09-05T00:00:00.000Z' },
          { id: 'empty', slug: 'empty', updatedAt: '2026-09-06T00:00:00.000Z' },
        ] : [{ id: 'life', slug: 'life', updatedAt: '2026-09-07T00:00:00.000Z' }],
        hasNextPage: page === 1,
      }
      if (collection === 'blogs') {
        const rows = page === 1 ? [
          { slug: 'green-tea', category: 'tea', publishedAt: '2026-09-01T00:00:00.000Z', _status: 'published', updatedAt: '2026-09-10T00:00:00.000Z' },
          { slug: 'future', category: 'empty', publishedAt: '2099-01-01T00:00:00.000Z', _status: 'published' },
          { slug: 'undated', category: 'empty', publishedAt: null, _status: 'published' },
          { slug: 'draft', category: 'empty', publishedAt: '2026-09-01T00:00:00.000Z', _status: 'draft' },
        ] : [{ slug: 'life-notes', category: 'life', publishedAt: '2026-09-02T00:00:00.000Z', _status: 'published', updatedAt: '2026-09-11T00:00:00.000Z' }]
        const visible = where?._status && where?.publishedAt
          ? rows.filter((row) => row._status === 'published' && row.publishedAt && row.publishedAt <= '2026-10-02T12:00:00.000Z')
          : rows
        return { docs: visible, hasNextPage: page === 1 }
      }
      throw new Error(`Unexpected collection: ${collection}`)
    })

    const { GET } = await import('@/app/(frontend)/(sitemaps)/blogs-sitemap.xml/route')
    const response = await GET()
    expect(response.headers.get('content-type')).toContain('xml')
    const entries = sitemapEntries(await response.text())
    expect(entries.map(({ loc }) => loc)).toEqual([
      'https://blog.example.test/blogs',
      'https://blog.example.test/blogs/category/tea-guides',
      'https://blog.example.test/blogs/category/life',
      'https://blog.example.test/blogs/green-tea',
      'https://blog.example.test/blogs/life-notes',
    ])
    expect(entries.slice(0, 3).every(({ lastmod }) => lastmod === undefined)).toBe(true)
    expect(entries.slice(3).every(({ lastmod }) => lastmod && !Number.isNaN(Date.parse(lastmod)))).toBe(true)
    expect(entries.find(({ loc }) => loc?.endsWith('/green-tea'))?.lastmod).toBe('2026-09-10T00:00:00.000Z')
    expect(find.mock.calls.filter(([args]) => args.collection === 'blogs').map(([args]) => args.page)).toEqual([1, 2])
    expect(find.mock.calls.filter(([args]) => args.collection === 'blog-categories').map(([args]) => args.page)).toEqual([1, 2])
    expect(find.mock.calls.filter(([args]) => args.collection === 'blog-categories').every(([args]) => args.sort === '_order')).toBe(true)
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['blogs-sitemap'], expect.objectContaining({ tags: ['blogs-sitemap'] }))
  })

  it('updates article lastmod without reporting stale category or index dates', async () => {
    let updatedAt = '2026-09-10T00:00:00.000Z'
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'blog-categories'
        ? [{ id: 'tea', slug: 'tea-guides', updatedAt: '2026-09-05T00:00:00.000Z' }]
        : [{ slug: 'green-tea', category: 'tea', publishedAt: '2026-09-01T00:00:00.000Z', updatedAt }],
      hasNextPage: false,
    }))
    const { GET } = await import('@/app/(frontend)/(sitemaps)/blogs-sitemap.xml/route')
    const first = sitemapEntries(await (await GET()).text())
    updatedAt = '2026-09-20T00:00:00.000Z'
    const second = sitemapEntries(await (await GET()).text())
    expect(first.map(({ lastmod }) => lastmod)).toEqual([undefined, undefined, '2026-09-10T00:00:00.000Z'])
    expect(second.map(({ lastmod }) => lastmod)).toEqual([undefined, undefined, '2026-09-20T00:00:00.000Z'])
  })

  it('escapes XML special characters in the site URL and slugs', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://blog.example.test?source=tea&kind=guide')
    find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'blog-categories'
        ? [{ id: 'tea', slug: 'tea&coffee', updatedAt: '2026-09-01T00:00:00.000Z' }]
        : [{ slug: 'green&black', category: 'tea', publishedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }],
      hasNextPage: false,
    }))
    const { GET } = await import('@/app/(frontend)/(sitemaps)/blogs-sitemap.xml/route')
    const xml = await (await GET()).text()
    expect(xml).toContain('tea&amp;coffee')
    expect(xml).toContain('green&amp;black')
    expect(xml).toContain('source=tea&amp;kind=guide')
    expect(sitemapEntries(xml)).toHaveLength(3)
  })

  it('invalidates the same sitemap tag after a published Blog changes', async () => {
    const { revalidateBlog } = await import('@/collections/Blogs/hooks/revalidateBlog')
    await revalidateBlog({
      req: { context: {}, payload: { findByID: vi.fn(async () => null) } },
      doc: { id: 'b1', slug: 'new', _status: 'published' },
      previousDoc: { id: 'b1', slug: 'old', _status: 'published' },
    } as never)
    expect(revalidateTag).toHaveBeenCalledWith('blogs-sitemap', 'max')
  })
})
