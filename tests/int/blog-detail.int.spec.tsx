import { cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Blog } from '@/payload-types'

const { mockDraftMode, mockGetBlogBySlug, mockGetRelatedBlogs, mockGetPayload, mockNotFound, mockGenerateMeta } = vi.hoisted(() => ({
  mockDraftMode: vi.fn(),
  mockGetBlogBySlug: vi.fn(),
  mockGetRelatedBlogs: vi.fn(),
  mockGetPayload: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  mockGenerateMeta: vi.fn(async () => ({ title: 'SEO title' })),
}))

vi.mock('next/headers', () => ({ draftMode: mockDraftMode }))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))
vi.mock('payload', () => ({ getPayload: mockGetPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/utilities/blogs/getBlogBySlug', () => ({ getBlogBySlug: mockGetBlogBySlug }))
vi.mock('@/utilities/blogs/getRelatedBlogs', () => ({ getRelatedBlogs: mockGetRelatedBlogs }))
vi.mock('@/utilities/generateMeta', () => ({ generateMeta: mockGenerateMeta }))
vi.mock('@/components/PayloadRedirects', () => ({ PayloadRedirects: ({ url, disableNotFound }: { url: string; disableNotFound?: boolean }) => { if (!disableNotFound) throw new Error('NEXT_NOT_FOUND'); return <span data-testid="redirect-check">{url}</span> } }))
vi.mock('@/components/LivePreviewListener', () => ({ LivePreviewListener: () => <span data-testid="preview-listener" /> }))
vi.mock('@/components/Media', () => ({ Media: ({ resource, presentation }: { resource: { alt: string }; presentation: string }) => <span role="img" aria-label={resource.alt} data-presentation={JSON.stringify(presentation)} /> }))
vi.mock('@/blocks/RenderBlocks', () => ({ RenderBlocks: ({ blocks, context }: { blocks: Blog['content']; context: string }) => <div data-testid="blocks" data-context={context}>{blocks.map((block) => <span key={block.blockType}>{block.blockType}</span>)}</div> }))

import BlogPage, { generateMetadata, generateStaticParams } from '@/app/(frontend)/blogs/[slug]/page'
import { BlogHero } from '@/heros/BlogHero'
import { RelatedBlogs } from '@/blocks/RelatedBlogs/Component'

const blog = {
  id: 'blog-1', title: 'Organic Tea Guide', slug: 'organic-tea-guide', excerpt: 'A guide to tea.',
  heroImage: { id: 'media-1', alt: 'Tea garden', mimeType: 'image/jpeg', url: '/tea.jpg' },
  category: { id: 'cat-1', title: 'Tea Guides', slug: 'tea-guides' },
  populatedAuthors: [{ id: 'author-1', name: 'Sarah Chen' }],
  publishedAt: '2026-09-28T00:00:00.000Z',
  content: ['prose', 'mediaBlock', 'keyTakeaways', 'cta', 'banner'].map((blockType) => ({ blockType, content: { root: { children: [] } } })),
  updatedAt: '2026-09-28T00:00:00.000Z', createdAt: '2026-09-28T00:00:00.000Z', _status: 'published',
  meta: { title: 'SEO title', description: 'SEO description' },
} as unknown as Blog
const related = [1, 2, 3].map((index) => ({
  ...blog, id: `related-${index}`, slug: `related-${index}`, title: `Related ${index}`,
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
    expect(container.querySelector('header + div [role=img]')?.getAttribute('data-presentation')).toContain('scale-down')
    expect(screen.getByRole('link', { name: 'Share on X' }).getAttribute('href')).toContain('organic-tea-guide')
    expect(screen.getByRole('link', { name: 'Share on Facebook' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Share on LinkedIn' })).toBeTruthy()
    expect(screen.getByTestId('blocks').getAttribute('data-context')).toBe('article')
    for (const type of ['prose', 'mediaBlock', 'keyTakeaways', 'cta', 'banner']) expect(screen.getByText(type)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'More to read' })).toBeTruthy()
    const cards = within(screen.getByRole('region', { name: 'More to read' })).getAllByRole('article')
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(['Related 1', 'Related 2', 'Related 3'])
    expect(mockGetBlogBySlug).toHaveBeenCalledWith(blog.slug, false)
    expect(mockGetRelatedBlogs).toHaveBeenCalledWith(blog, expect.anything())
  })

  it('shows a TOC matching prose headings and hides empty related cards', async () => {
    const prose = { blockType: 'prose', content: { root: { children: [{ type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Growing tea' }] }] } } }
    mockGetBlogBySlug.mockResolvedValue({ ...blog, content: [prose] })
    mockGetRelatedBlogs.mockResolvedValue([])
    render(await BlogPage(args))
    expect(screen.getAllByRole('navigation', { name: 'Table of contents' })[0].textContent).toContain('Growing tea')
    expect(screen.queryByRole('region', { name: 'More to read' })).not.toBeTruthy()
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

  it('pre-generates only visible published slugs', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ slug: 'visible' }], hasNextPage: false })
    mockGetPayload.mockResolvedValue({ find })
    expect(await generateStaticParams()).toEqual([{ slug: 'visible' }])
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'blogs', draft: false, overrideAccess: false, where: expect.objectContaining({ _status: { equals: 'published' }, publishedAt: expect.anything() }) }))
  })
})

describe('article components', () => {
  it('renders author initial fallback and no more than three related cards', () => {
    const { container } = render(<><BlogHero blog={blog} /><RelatedBlogs blogs={[...related, { ...blog, id: 'extra', slug: 'extra' }]} /></>)
    expect(container.querySelector('[aria-label="Sarah Chen"]')?.textContent).toBe('SC')
    expect(within(screen.getByRole('region', { name: 'More to read' })).getAllByRole('article')).toHaveLength(3)
  })
})
