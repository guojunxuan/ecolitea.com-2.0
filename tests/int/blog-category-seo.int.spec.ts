import { describe, expect, it, vi } from 'vitest'
import { BlogCategories } from '@/collections/BlogCategories'
import { imageOnly } from '@/collections/mediaUploadPolicy'
import { generateTitle, generateDescription, generateURL, generateImage } from '@/plugins'
import { getServerSideURL } from '@/utilities/getURL'

const input = (doc: Record<string, unknown>) => ({
  collectionConfig: { slug: 'blog-categories' },
  doc,
})

describe('Blog category SEO configuration', () => {
  it('uses Content and optional native SEO tabs while preserving sidebar slug and join', () => {
    const tabs = BlogCategories.fields.find((field) => field.type === 'tabs')
    expect(tabs?.type).toBe('tabs')
    if (tabs?.type !== 'tabs') throw new Error('Missing category tabs')
    expect(tabs.tabs[0]).toMatchObject({
      label: 'Content',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    })
    const seo = tabs.tabs.find((tab) => 'name' in tab && tab.name === 'meta')!
    expect(seo.label).toBe('SEO')
    for (const name of ['title', 'description', 'image']) {
      const field = seo.fields.find((field) => 'name' in field && field.name === name)!
      expect(field).toBeDefined()
      expect('required' in field && field.required).toBeFalsy()
    }
    expect(seo.fields.find((field) => 'name' in field && field.name === 'image')).toMatchObject({
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOnly,
      admin: { components: { Field: { clientProps: { hasGenerateImageFn: true } } } },
    })
    expect(BlogCategories.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'slug', admin: { position: 'sidebar' } }),
        expect.objectContaining({
          name: 'blogs',
          type: 'join',
          collection: 'blogs',
          on: 'category',
        }),
      ]),
    )
    expect(BlogCategories.orderable).toBe(true)
  })

  it('generates category title, description and URL', () => {
    const args = input({ title: 'Green Tea', slug: 'green-tea', description: 'Tea guidance' })
    expect(generateTitle(args as never)).toBe('Green Tea Blogs | Ecolitea')
    expect(generateTitle(input({}) as never)).toBe('Ecolitea')
    expect(generateDescription(args as never)).toBe('Tea guidance')
    expect(generateDescription(input({ title: 'Green Tea' }) as never)).toBe(
      'Explore green tea articles and guides.',
    )
    expect(generateURL(args as never)).toBe(`${getServerSideURL()}/blogs/category/green-tea`)
    expect(generateURL(input({}) as never)).toBe(`${getServerSideURL()}/blogs`)
  })

  it('uses only the latest publicly visible category Blog, with request access and image validation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T00:00:00Z'))
    try {
      const req = {
        payload: {
          find: vi.fn().mockResolvedValue({ docs: [{ heroImage: { id: 'hero' } }] }),
          findByID: vi.fn().mockResolvedValue({ mimeType: 'image/jpeg' }),
        },
      }
      expect(await generateImage({ ...input({ id: 'tea' }), req } as never)).toBe('hero')
      expect(req.payload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'blogs',
          depth: 0,
          draft: false,
          limit: 1,
          sort: '-publishedAt',
          overrideAccess: false,
          req,
          where: {
            and: [
              { category: { equals: 'tea' } },
              {
                _status: { equals: 'published' },
                publishedAt: { less_than_equal: '2026-10-21T00:00:00.000Z' },
              },
            ],
          },
        }),
      )
      expect(req.payload.findByID).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'media', id: 'hero', overrideAccess: false, req }),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([undefined, 'video/mp4', 'application/pdf'])(
    'keeps current image with absent or invalid source %s',
    async (mimeType) => {
      const req = {
        payload: {
          find: vi.fn().mockResolvedValue({ docs: mimeType ? [{ heroImage: 'hero' }] : [] }),
          findByID: vi.fn().mockResolvedValue({ mimeType }),
        },
      }
      expect(
        await generateImage({ ...input({ id: 'tea', meta: { image: 'current' } }), req } as never),
      ).toBe('current')
    },
  )

  it('never queries all Blogs for an unsaved category', async () => {
    const req = { payload: { find: vi.fn(), findByID: vi.fn() } }
    expect(await generateImage({ ...input({}), req } as never)).toBe('')
    expect(req.payload.find).not.toHaveBeenCalled()
  })
})
