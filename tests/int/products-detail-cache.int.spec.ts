import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  auth: vi.fn(),
  settings: vi.fn(),
  cache: new Map<string, unknown>(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => mocks }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedSettings: mocks.settings }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>, keys: string[]) => async () => {
    const key = JSON.stringify(keys)
    if (!mocks.cache.has(key)) mocks.cache.set(key, await fn())
    return mocks.cache.get(key)
  },
}))
import { getProductBySlug } from '@/utilities/products/getProductBySlug'
import { toProductDetail } from '@/utilities/products/shared'

const product = (mode?: string) => ({
  id: 'product',
  title: 'Tea',
  summary: 'Tea',
  slug: 'tea',
  inquiry: { mode, buttons: [{ link: { type: 'custom', url: '/contact', label: 'Legacy' } }] },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cache.clear()
  mocks.auth.mockResolvedValue({ user: null })
})

describe('product detail cache boundary', () => {
  it('caches raw products by stable ID and normalizes every read without Settings', async () => {
    mocks.find.mockResolvedValue({ docs: [product('default')] })
    for (let i = 0; i < 2; i++) {
      const detail = await getProductBySlug('tea')
      expect(detail?.title).toBe('Tea')
      expect(detail).not.toHaveProperty('inquiry')
    }
    expect(mocks.cache.get(JSON.stringify(['product-detail-v2', 'product']))).toEqual(
      product('default'),
    )
    expect(mocks.find.mock.calls.filter(([args]) => args.depth === 2)).toHaveLength(1)
    expect(mocks.find.mock.calls.filter(([args]) => args.depth === 0)).toHaveLength(2)
    expect(mocks.settings).not.toHaveBeenCalled()
  })

  it.each(['default', 'custom', 'hidden', undefined])(
    'ignores legacy %s inquiry data for public products and authorized drafts',
    async (mode) => {
      mocks.find.mockResolvedValue({ docs: [product(mode)] })
      mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
      for (const draft of [false, true]) {
        const detail = await getProductBySlug('tea', { draft })
        expect(detail?.id).toBe('product')
        expect(detail).not.toHaveProperty('inquiry')
      }
      expect(mocks.settings).not.toHaveBeenCalled()
    },
  )

  it('keeps authorized drafts outside the product cache', async () => {
    mocks.find.mockResolvedValue({ docs: [product()] })
    mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
    expect((await getProductBySlug('tea', { draft: true }))?.title).toBe('Tea')
    expect(mocks.cache.size).toBe(0)
  })

  it('returns null for a missing product without loading Settings', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    expect(await getProductBySlug('missing')).toBeNull()
    expect(mocks.settings).not.toHaveBeenCalled()
  })

  it('omits obsolete inquiry fields from normalized models', () => {
    expect(toProductDetail(product('custom') as never)).not.toHaveProperty('inquiry')
  })
})
