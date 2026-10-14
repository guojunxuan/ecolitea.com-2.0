import { readFileSync } from 'node:fs'
import { cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Blog } from '@/payload-types'

const {
  mockDraftMode,
  mockGetBlogBySlug,
  mockGetRelatedBlogs,
  mockGetPayload,
  mockNotFound,
  mockGenerateMeta,
} = vi.hoisted(() => ({
  mockDraftMode: vi.fn(),
  mockGetBlogBySlug: vi.fn(),
  mockGetRelatedBlogs: vi.fn(),
  mockGetPayload: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  mockGenerateMeta: vi.fn(async () => ({ title: 'SEO title' })),
}))

vi.mock('next/headers', () => ({ draftMode: mockDraftMode }))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))
vi.mock('payload', () => ({ getPayload: mockGetPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/utilities/blogs/getBlogBySlug', () => ({ getBlogBySlug: mockGetBlogBySlug }))
vi.mock('@/utilities/blogs/getRelatedBlogs', () => ({ getRelatedBlogs: mockGetRelatedBlogs }))
vi.mock('@/utilities/generateMeta', () => ({ generateMeta: mockGenerateMeta }))
vi.mock('@/utilities/getGlobals', () => ({
  getCachedSettings: async () => ({ blog: { article: { share: { copyLink: true } } } }),
}))
vi.mock('@/components/PayloadRedirects', () => ({
  PayloadRedirects: ({ url, disableNotFound }: { url: string; disableNotFound?: boolean }) => {
    if (!disableNotFound) throw new Error('NEXT_NOT_FOUND')
    return <span data-testid="redirect-check">{url}</span>
  },
}))
vi.mock('@/components/LivePreviewListener', () => ({
  LivePreviewListener: () => <span data-testid="preview-listener" />,
}))
vi.mock('@/components/Media', () => ({
  Media: ({ resource, presentation }: { resource: { alt: string }; presentation: string }) => (
    <span role="img" aria-label={resource.alt} data-presentation={JSON.stringify(presentation)} />
  ),
}))
vi.mock('@/components/RichText', () => ({
  default: ({
    data,
    context,
    headingIds,
  }: {
    data: Blog['content']
    context: string
    headingIds?: string[]
  }) => (
    <div data-testid="rich-text" data-context={context} data-heading-ids={headingIds?.join(',')}>
      {data.root.children.map((node, index) => (
        <span key={index}>{node.type === 'block' ? node.fields.blockType : node.type}</span>
      ))}
    </div>
  ),
}))

import BlogPage, {
  generateMetadata,
  generateStaticParams,
} from '@/app/(frontend)/blogs/[slug]/page'
import { BlogHero } from '@/heros/BlogHero'
import { RelatedBlogs } from '@/blocks/RelatedBlogs/Component'

const blog = {
  id: 'blog-1',
  title: 'Organic Tea Guide',
  slug: 'organic-tea-guide',
  excerpt: 'A guide to tea.',
  heroImage: { id: 'media-1', alt: 'Tea garden', mimeType: 'image/jpeg', url: '/tea.jpg' },
  category: { id: 'cat-1', title: 'Tea Guides', slug: 'tea-guides' },
  populatedAuthors: [{ id: 'author-1', name: 'Sarah Chen' }],
  publishedAt: '2026-09-28T00:00:00.000Z',
  content: {
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: ['mediaBlock', 'keyTakeaways', 'cta', 'banner'].map((blockType, index) => ({
        type: 'block',
        version: 2,
        fields: { id: String(index), blockType },
      })),
    },
  },
  updatedAt: '2026-09-28T00:00:00.000Z',
  createdAt: '2026-09-28T00:00:00.000Z',
  _status: 'published',
  meta: { title: 'SEO title', description: 'SEO description' },
} as unknown as Blog
const related = [1, 2, 3].map((index) => ({
  ...blog,
  id: `related-${index}`,
  slug: `related-${index}`,
  title: `Related ${index}`,
}))
const args = { params: Promise.resolve({ slug: blog.slug }) }

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mockDraftMode.mockResolvedValue({ isEnabled: false })
  mockGetBlogBySlug.mockResolvedValue(blog)
  mockGetRelatedBlogs.mockResolvedValue(related)
  mockGetPayload.mockResolvedValue({ find: vi.fn().mockResolvedValue({ docs: [] }) })
})

describe('blog detail', () => {
  it('renders the hero, article blocks, TOC, and ordered related cards', async () => {
    const { container } = render(await BlogPage(args))
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Blogs')
    expect(screen.getByRole('heading', { name: blog.title, level: 1 })).toBeTruthy()
    expect(screen.getByText('Sarah Chen')).toBeTruthy()
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(blog.publishedAt)
    expect(
      container.querySelector('header + div [role=img]')?.getAttribute('data-presentation'),
    ).toContain('scale-down')
    expect(screen.getAllByRole('button', { name: 'Copy link' })).toHaveLength(2)
    expect(container.querySelector('header > p')?.textContent).toBe(blog.excerpt)
    expect(container.querySelector('time')?.textContent).toBe('September 28, 2026')
    expect(screen.getByTestId('rich-text').getAttribute('data-context')).toBe('article')
    for (const type of ['mediaBlock', 'keyTakeaways', 'cta', 'banner'])
      expect(screen.getByText(type)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'More to read' })).toBeTruthy()
    const cards = within(screen.getByRole('region', { name: 'More to read' })).getAllByRole(
      'article',
    )
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Related 1',
      'Related 2',
      'Related 3',
    ])
    expect(mockGetBlogBySlug).toHaveBeenCalledWith(blog.slug, false)
    expect(mockGetRelatedBlogs).toHaveBeenCalledWith(blog, expect.anything())
  })

  it('shows a TOC matching rich text headings and hides empty related cards', async () => {
    const content = {
      root: {
        type: 'root',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        children: [
          { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Growing tea' }] },
        ],
      },
    }
    mockGetBlogBySlug.mockResolvedValue({ ...blog, content })
    mockGetRelatedBlogs.mockResolvedValue([])
    const { container } = render(await BlogPage(args))
    const body = container.querySelector('[data-slot="blog-article-body"]')
    expect(Array.from(body?.children ?? [], (child) => child.tagName)).toEqual(['ASIDE', 'DIV'])
    expect(body?.querySelector('[data-slot="blog-article-content"]')).toBeTruthy()
    expect(
      screen.getAllByRole('navigation', { name: 'Table of contents' })[0].textContent,
    ).toContain('Growing tea')
    expect(
      screen.getByRole('link', { name: 'Skip to table of contents' }).getAttribute('href'),
    ).toBe('#table-of-contents')
    expect(container.querySelectorAll('#table-of-contents')).toHaveLength(1)
    expect(container.querySelector('#table-of-contents')?.getAttribute('tabindex')).toBe('-1')
    expect(screen.queryByRole('region', { name: 'More to read' })).not.toBeTruthy()
  })

  it('keeps heading-free articles in the reading column without an empty TOC grid item', async () => {
    mockGetRelatedBlogs.mockResolvedValue([])
    const { container } = render(await BlogPage(args))
    const body = container.querySelector('[data-slot="blog-article-body"]')
    expect(body).not.toBeNull()
    expect(Array.from(body?.children ?? [], (child) => child.getAttribute('data-slot'))).toEqual([
      'blog-article-tools',
      'blog-article-content',
    ])
    expect(screen.queryByRole('navigation', { name: 'Table of contents' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Skip to table of contents' })).toBeNull()
  })

  it('reads draft content only in draft mode and enables the preview listener', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: true })
    render(await BlogPage(args))
    expect(mockGetBlogBySlug).toHaveBeenCalledWith(blog.slug, true)
    expect(screen.getByTestId('preview-listener')).toBeTruthy()
  })

  it.each(['missing', 'future', 'unpublished'])('does not expose a %s blog', async () => {
    mockGetBlogBySlug.mockResolvedValue(null)
    const element = await BlogPage({ params: Promise.resolve({ slug: 'hidden' }) })
    expect(() => render(element)).toThrow('NEXT_NOT_FOUND')
    expect(mockGetRelatedBlogs).not.toHaveBeenCalled()
  })

  it('generates metadata for the same visible article and canonical blog URL', async () => {
    const metadata = await generateMetadata(args)
    expect(mockGetBlogBySlug).toHaveBeenCalledWith(blog.slug, false)
    expect(mockGenerateMeta).toHaveBeenCalledWith({ doc: blog })
    expect(metadata.alternates?.canonical).toBe('/blogs/organic-tea-guide')
  })

  it('falls back to the excerpt for both description and Open Graph', async () => {
    mockGetBlogBySlug.mockResolvedValue({ ...blog, meta: {} })
    const metadata = await generateMetadata(args)
    expect(metadata.description).toBe(blog.excerpt)
    expect(metadata.openGraph?.description).toBe(blog.excerpt)
  })

  it('pre-generates only visible published slugs', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ slug: 'visible' }], hasNextPage: false })
    mockGetPayload.mockResolvedValue({ find })
    expect(await generateStaticParams()).toEqual([{ slug: 'visible' }])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'blogs',
        draft: false,
        overrideAccess: false,
        where: expect.objectContaining({
          _status: { equals: 'published' },
          publishedAt: expect.anything(),
        }),
      }),
    )
  })
})

describe('article components', () => {
  it('renders the byline and no more than three related cards', () => {
    const { container } = render(
      <>
        <BlogHero blog={blog} />
        <RelatedBlogs blogs={[...related, { ...blog, id: 'extra', slug: 'extra' }]} />
      </>,
    )
    expect(container.querySelector('header strong')?.textContent).toBe('Sarah Chen')
    expect(container.querySelector('header')?.textContent).toContain('By Sarah Chen')
    expect(container.querySelector('header a')).toBeNull()
    expect(
      within(screen.getByRole('region', { name: 'More to read' })).getAllByRole('article'),
    ).toHaveLength(3)
  })
})

describe('article layout contract', () => {
  it('uses a left-aligned main column and keeps the mobile sticky bar within the body', () => {
    const css = readFileSync('src/app/(frontend)/blogs/[slug]/page.module.css', 'utf8')
    expect(css).toContain('minmax(0, 1fr) 17.5rem')
    expect(css).toContain('clamp(3rem, 6vw, 6rem)')
    expect(css).not.toContain('justify-self: center')
    expect(css).not.toContain('column-reverse')
    expect(css).toContain('calc(var(--header-height) + 2.5rem)')
    expect(css).toContain('calc(var(--header-height) + 3.5rem)')
  })
})

it('keeps a long category accessible while allowing its breadcrumb to shrink', () => {
  const title = 'Product materials and manufacturing practices for long-lasting everyday equipment'
  render(<BlogHero blog={{ ...blog, category: { ...(blog.category as object), title } } as Blog} />)
  const link = screen.getByRole('link', { name: title })
  expect(link.textContent).toBe(title)
  expect(link.parentElement?.className).toContain('categoryCrumb')
  const css = readFileSync('src/heros/BlogHero/index.module.css', 'utf8')
  expect(css).toMatch(
    /\.breadcrumb \.categoryCrumb\s*\{[^}]*min-width:\s*0;[^}]*flex-shrink:\s*1;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/s,
  )
})
