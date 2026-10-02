import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { getContentPath } from '@/utilities/getContentPath'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { generateTitle, generateURL, generateDescription, plugins } from '@/plugins'
import { headerLinkTargets } from '@/Header/fields/links'
import { Footer } from '@/Footer/config'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { searchFields } from '@/search/fieldOverrides'
import { publicSearchVisibility } from '@/search/visibility'

describe('Blog site integrations', () => {
  it.each([
    ['pages', 'about', '/about'],
    ['posts', 'news', '/posts/news'],
    ['blogs', 'tea', '/blogs/tea'],
    ['blog-categories', 'brewing', '/blogs/category/brewing'],
    ['case-studies', 'client', '/case-studies/client'],
  ] as const)('resolves %s paths', (relationTo, slug, expected) => {
    expect(getContentPath(relationTo, slug)).toBe(expected)
  })

  it('generates the Blog preview path', () => {
    const preview = generatePreviewPath({ collection: 'blogs', slug: 'green-tea', req: {} as PayloadRequest })
    expect(new URL(preview!, 'https://example.test').searchParams.get('path')).toBe('/blogs/green-tea')
  })

  it.each([
    ['pages', 'about', '/about'],
    ['posts', 'tea', '/posts/tea'],
    ['blogs', 'tea', '/blogs/tea'],
    ['case-studies', 'client', '/case-studies/client'],
  ] as const)('generates the canonical %s SEO URL', (slug, docSlug, path) => {
    expect(generateURL({ collectionConfig: { slug } as never, doc: { slug: docSlug } } as never))
      .toBe(`http://localhost:3000${path}`)
  })

  it('uses Blog title and excerpt for SEO and preserves Page/Post titles', () => {
    expect(generateTitle({ collectionConfig: { slug: 'blogs' }, doc: { title: 'Tea Notes' } } as never))
      .toBe('Tea Notes | Ecolitea')
    expect(generateDescription({ collectionConfig: { slug: 'blogs' }, doc: { excerpt: 'Fresh leaves' } } as never))
      .toBe('Fresh leaves')
    expect(generateTitle({ collectionConfig: { slug: 'posts' }, doc: { title: 'News' } } as never))
      .toBe('News | Payload Website Template')
    expect(generateTitle({ collectionConfig: { slug: 'pages' }, doc: { title: 'About' } } as never))
      .toBe('About | Payload Website Template')
  })

  it('allows Blog and Blog Category navigation references', () => {
    expect(headerLinkTargets).toEqual(expect.arrayContaining(['blogs', 'blog-categories']))
    const navigation = Footer.fields[0]
    expect(JSON.stringify(navigation)).toContain('blog-categories')
    expect(JSON.stringify(navigation)).toContain('blogs')
  })

  it('registers Blogs for redirects and search indexing', async () => {
    const collections = ['pages', 'posts', 'blogs'].map((slug) => ({ slug, fields: [] }))
    const config = { collections, globals: [] }
    const redirects = plugins.find((plugin) => plugin.slug === '@payloadcms/plugin-redirects')!
    const search = plugins.find((plugin) => plugin.slug === '@payloadcms/plugin-search')!
    const redirectsConfig = await redirects(config as never)
    const searchConfig = await search(config as never)
    const redirectCollection = redirectsConfig.collections!.find((entry) => entry.slug === 'redirects')!
    const destination = redirectCollection.fields.find((field) => 'name' in field && field.name === 'to')!
    expect(JSON.stringify(destination)).toContain('blogs')
    expect(searchConfig.collections!.find((entry) => entry.slug === 'blogs')?.hooks?.afterChange?.length).toBeGreaterThan(0)
    const searchCollection = searchConfig.collections!.find((entry) => entry.slug === 'search')!
    const read = searchCollection.access?.read as (args: unknown) => unknown
    const publicWhere = read({ req: {} })
    expect(publicWhere).toMatchObject({ or: expect.arrayContaining([
      { 'doc.relationTo': { equals: 'posts' } },
      { and: expect.arrayContaining([
        { 'doc.relationTo': { equals: 'blogs' } },
        { publishedAt: { less_than_equal: expect.any(String) } },
      ]) },
    ]) })
    expect(JSON.stringify(publicWhere)).not.toContain('blogStatus')
  })

  it('lets existing Blog index rows without blogStatus appear only after their publication date', () => {
    const publication = '2026-08-01T00:00:00.000Z'
    const before = publicSearchVisibility(new Date('2026-07-31T23:59:59.000Z'))
    const after = publicSearchVisibility(new Date('2026-08-01T00:00:01.000Z'))
    expect(before).toEqual({ or: [
      { 'doc.relationTo': { equals: 'posts' } },
      { and: [
        { 'doc.relationTo': { equals: 'blogs' } },
        { publishedAt: { less_than_equal: '2026-07-31T23:59:59.000Z' } },
      ] },
    ] })
    expect(after).toEqual({ or: [
      { 'doc.relationTo': { equals: 'posts' } },
      { and: [
        { 'doc.relationTo': { equals: 'blogs' } },
        { publishedAt: { less_than_equal: '2026-08-01T00:00:01.000Z' } },
      ] },
    ] })
    expect(publication > '2026-07-31T23:59:59.000Z').toBe(true)
    expect(publication <= '2026-08-01T00:00:01.000Z').toBe(true)
  })

  it('indexes a published future Blog but does not index an unpublished draft', async () => {
    const search = plugins.find((plugin) => plugin.slug === '@payloadcms/plugin-search')!
    const config = await search({ collections: [{ slug: 'blogs', fields: [] }], globals: [] } as never)
    const blog = config.collections!.find((entry) => entry.slug === 'blogs')!
    const sync = blog.hooks?.afterChange?.at(-1)!
    const create = vi.fn()
    const req = { payload: { create, config: {}, logger: { error: vi.fn() } }, context: {} }
    const published = {
      id: 'blog-2', title: 'Future Blog', slug: 'future-blog', excerpt: 'Coming soon',
      _status: 'published', publishedAt: '2999-01-01T00:00:00.000Z',
    }
    await sync({ doc: published, operation: 'create', req } as never)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'search', data: expect.objectContaining({ publishedAt: published.publishedAt }),
    }))

    create.mockClear()
    await sync({ doc: { ...published, id: 'blog-3', _status: 'draft' }, operation: 'create', req: { ...req, context: {} } } as never)
    expect(create).not.toHaveBeenCalled()
  })

  it('removes a stale Blog index row when its source has no published version', async () => {
    const search = plugins.find((plugin) => plugin.slug === '@payloadcms/plugin-search')!
    const config = await search({ collections: [{ slug: 'blogs', fields: [] }], globals: [] } as never)
    const sync = config.collections!.find((entry) => entry.slug === 'blogs')!.hooks?.afterChange?.at(-1)!
    const remove = vi.fn()
    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [{ id: 'search-1', priority: 0 }] })
      .mockResolvedValueOnce({ docs: [] })
    const req = { payload: { find, delete: remove, config: {}, logger: { error: vi.fn() } }, context: {} }

    await sync({
      doc: { id: 'blog-4', title: 'Unpublished Blog', _status: 'draft', publishedAt: null },
      operation: 'update',
      req,
    } as never)

    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'blogs', draft: false,
      where: expect.objectContaining({ and: expect.arrayContaining([{ _status: { equals: 'published' } }]) }),
    }))
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ collection: 'search', id: 'search-1' }))
  })

  it('indexes a Blog title, excerpt, and category without copying private fields', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 'cat-1', title: 'Brewing' })
    const result = await beforeSyncWithSearch({
      req: { payload: { findByID } },
      originalDoc: {
        id: 'blog-1', slug: 'green-tea', title: 'Green Tea', excerpt: 'A guide', _status: 'published',
        category: 'cat-1', authors: ['private-author'], content: [{ blockType: 'prose' }],
      },
      searchDoc: { title: 'Green Tea', doc: { relationTo: 'blogs', value: 'blog-1' } },
    } as never)

    expect(result).toMatchObject({
      title: 'Green Tea', slug: 'green-tea', excerpt: 'A guide',
      category: { relationTo: 'blog-categories', categoryID: 'cat-1', title: 'Brewing' },
      meta: { title: 'Green Tea', description: 'A guide' },
    })
    expect(result).not.toHaveProperty('authors')
    expect(result).not.toHaveProperty('content')
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blog-categories', id: 'cat-1' }))
  })

  it('preserves Post meta and category search fields', async () => {
    const result = await beforeSyncWithSearch({
      req: { payload: { findByID: vi.fn() } },
      originalDoc: {
        id: 'post-1', slug: 'news', title: 'News',
        categories: [{ id: 'cat-1', title: 'Updates' }],
        meta: { title: 'Latest News', description: 'Post summary', image: { id: 'image-1' } },
      },
      searchDoc: { title: 'News', doc: { relationTo: 'posts', value: 'post-1' } },
    } as never)

    expect(result).toMatchObject({
      slug: 'news',
      meta: { title: 'Latest News', description: 'Post summary', image: 'image-1' },
      categories: [{ relationTo: 'categories', categoryID: 'cat-1', title: 'Updates' }],
    })
  })

  it('declares the Blog fields needed by search results', () => {
    expect(searchFields.map((field) => 'name' in field ? field.name : null))
      .toEqual(expect.arrayContaining(['excerpt', 'category', 'heroImage', 'publishedAt']))
    expect(searchFields.map((field) => 'name' in field ? field.name : null)).not.toContain('blogStatus')
  })
})
