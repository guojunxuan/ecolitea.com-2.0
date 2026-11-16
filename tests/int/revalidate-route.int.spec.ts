// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { env, path, tag } = vi.hoisted(() => ({
  env: {
    REVALIDATE_SECRET: 'phase2-only',
    NEXT_PUBLIC_SERVER_URL: 'https://server.example.invalid',
  },
  path: vi.fn(),
  tag: vi.fn(),
}))
vi.mock('@/utilities/env', () => ({ serverEnv: env }))
vi.mock('next/cache', () => ({ revalidatePath: path, revalidateTag: tag }))
import { POST } from '@/app/(frontend)/next/revalidate/route'
import { createRevalidation, requestRevalidation } from '@/plugins/translation/revalidate'
import { RetryableTranslationError } from '@/plugins/translation/provider/types'

const request = (body: unknown, authorization = 'Bearer phase2-only') =>
  new Request('https://server.example.invalid/next/revalidate', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  path.mockReset()
  tag.mockReset()
  env.REVALIDATE_SECRET = 'phase2-only'
})
afterEach(() => vi.unstubAllGlobals())

describe('authenticated Next revalidation boundary', () => {
  it('denies invalid authentication without touching cache', async () => {
    expect((await POST(request({ tags: ['a'] }, 'Bearer invalid'))).status).toBe(401)
    expect(tag).not.toHaveBeenCalled()
  })
  it('returns 503 when the server secret is absent', async () => {
    env.REVALIDATE_SECRET = ''
    expect((await POST(request({}))).status).toBe(503)
  })
  it('invalidates tags immediately and accepts bounded literal and dynamic paths', async () => {
    expect(
      (
        await POST(
          request({ tags: ['translation:pages:1:de'], paths: ['/about', '/posts/[slug]'] }),
        )
      ).status,
    ).toBe(204)
    expect(tag).toHaveBeenCalledWith('translation:pages:1:de', { expire: 0 })
    expect(path).toHaveBeenCalledWith('/en/about')
    expect(path).toHaveBeenCalledWith('/[lang]/posts/[slug]', 'page')
  })
  it.each([
    null,
    [],
    { tags: 'one' },
    { paths: [1] },
    { tags: [''] },
    { paths: ['https://elsewhere.invalid'] },
    { tags: Array(101).fill('a') },
    { tags: ['a'.repeat(257)] },
    { paths: ['/' + 'a'.repeat(1024)] },
  ])('rejects invalid input %j before invalidating anything', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(tag).not.toHaveBeenCalled()
    expect(path).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON', async () => {
    const req = new Request('https://server.example.invalid/next/revalidate', {
      method: 'POST',
      headers: { Authorization: 'Bearer phase2-only' },
      body: '{',
    })
    expect((await POST(req)).status).toBe(400)
  })
})

describe('background cache fallback', () => {
  it('covers the other native scheduled-publication hook owners', async () => {
    path.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing')
    })
    tag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing')
    })
    const http = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', http)
    const hooks = [
      (await import('@/collections/Pages/hooks/revalidatePage')).revalidatePage,
      (await import('@/collections/Posts/hooks/revalidatePost')).revalidatePost,
      (await import('@/collections/CaseStudies/hooks/revalidateCaseStudy')).revalidateCaseStudy,
      (await import('@/collections/Blogs/hooks/revalidateBlog')).revalidateBlog,
    ]
    for (const hook of hooks)
      await hook({
        doc: { id: 'source', slug: 'tea', _status: 'published' },
        previousDoc: { id: 'source', slug: 'tea', _status: 'draft' },
        req: { context: {}, payload: { logger: { info: vi.fn() }, findByID: vi.fn() } },
      } as never)
    expect(http.mock.calls.length).toBeGreaterThanOrEqual(4)
    const paths = http.mock.calls.flatMap(
      ([, init]) => JSON.parse(init!.body as string).paths as string[],
    )
    expect(paths).toEqual(
      expect.arrayContaining(['/en/tea', '/en/posts/tea', '/en/case-studies/tea', '/en/blogs/tea']),
    )
  })

  it('keeps the direct Next request profiles without HTTP', () => {
    const http = vi.fn()
    vi.stubGlobal('fetch', http)
    const cache = createRevalidation()
    cache.revalidatePath('/products')
    cache.revalidateTag('products-list', 'max')
    cache.flush()
    expect(path).toHaveBeenCalledWith('/en/products')
    expect(tag).toHaveBeenCalledWith('products-list', 'max')
    expect(http).not.toHaveBeenCalled()
  })
  it('sends the complete invalidation set when Next has no work store', async () => {
    path.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing')
    })
    const http = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', http)
    const cache = createRevalidation()
    cache.revalidatePath('/products/tea/leaf')
    cache.revalidateTag('product-1', 'max')
    await cache.flush()
    expect(http).toHaveBeenCalledWith(
      'https://server.example.invalid/next/revalidate',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer phase2-only' }),
      }),
    )
    expect(JSON.parse(http.mock.calls[0][1]!.body as string)).toEqual({
      paths: ['/en/products/tea/leaf'],
      tags: ['product-1'],
    })
  })
  it('does not mask unrelated cache errors', () => {
    const error = new Error('Invalid cache usage during render')
    tag.mockImplementation(() => {
      throw error
    })
    const cache = createRevalidation()
    cache.revalidateTag('a', 'max')
    expect(() => cache.flush()).toThrow(error)
  })
  it('batches large requests at the handler bound and makes endpoint failures retryable', async () => {
    const http = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', http)
    await requestRevalidation({ tags: Array.from({ length: 201 }, (_, i) => `tag-${i}`) })
    expect(http).toHaveBeenCalledTimes(3)
    for (const [, init] of http.mock.calls)
      expect(JSON.parse(init!.body as string).tags.length).toBeLessThanOrEqual(100)
    http.mockResolvedValue(new Response(null, { status: 503 }))
    await expect(requestRevalidation({ tags: ['a'] })).rejects.toBeInstanceOf(
      RetryableTranslationError,
    )
  })
})
