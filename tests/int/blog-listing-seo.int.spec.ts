import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCachedSettings } = vi.hoisted(() => ({ getCachedSettings: vi.fn() }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedSettings }))
vi.mock('@/utilities/getURL', () => ({ getServerSideURL: () => 'https://ecolitea.example' }))

import { getBlogListingSEO } from '@/utilities/blogs/getBlogListingSEO'

beforeEach(() => getCachedSettings.mockReset())

describe('getBlogListingSEO', () => {
  it('returns empty optional values for missing settings', async () => {
    getCachedSettings.mockResolvedValue(null)
    expect(await getBlogListingSEO()).toEqual({})
  })

  it('trims filled text and ignores whitespace-only values', async () => {
    getCachedSettings.mockResolvedValue({
      blog: {
        seo: {
          title: '  Tea Journal  ',
          description: '   ',
        },
      },
    })
    expect(await getBlogListingSEO()).toEqual({ title: 'Tea Journal' })
  })

  it('resolves a populated Media URL without provider-specific rewriting', async () => {
    getCachedSettings.mockResolvedValue({
      blog: {
        seo: {
          description: '  Stories about tea  ',
          image: { id: 'image-id', url: '/api/media/file/blog-og.png' },
        },
      },
    })
    expect(await getBlogListingSEO()).toEqual({
      description: 'Stories about tea',
      imageURL: 'https://ecolitea.example/api/media/file/blog-og.png',
    })
  })

  it.each(['image-id', { id: 'image-id' }, null])('skips unresolved image %j', async (image) => {
    getCachedSettings.mockResolvedValue({ blog: { seo: { image } } })
    expect(await getBlogListingSEO()).toEqual({})
  })

  it('ignores a Media URL that is not an HTTP image location', async () => {
    getCachedSettings.mockResolvedValue({
      blog: {
        seo: {
          image: { id: 'image-id', url: 'javascript:alert(1)' },
        },
      },
    })
    expect(await getBlogListingSEO()).toEqual({})
  })
})
