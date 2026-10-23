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
import { getProductBySlug, productDetailPopulate } from '@/utilities/products/getProductBySlug'
import { toProductDetail } from '@/utilities/products/shared'
const button = (label: string) => ({
  link: {
    type: 'reference',
    label,
    appearance: 'outline',
    newTab: true,
    reference: { relationTo: 'pages', value: { id: 'page', slug: 'contact' } },
  },
})
const product = (mode?: string) => ({
  id: 'product',
  title: 'Tea',
  summary: 'Tea',
  slug: 'tea',
  inquiry: { mode, buttons: [button('Custom')] },
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.cache.clear()
  mocks.auth.mockResolvedValue({ user: null })
  mocks.settings.mockResolvedValue({ product: { inquiry: { buttons: [button('Default')] } } })
})
describe('product inquiry at the detail cache boundary', () => {
  it.each(['default', undefined])(
    'resolves %s after the populated product cache and reflects changed Settings',
    async (mode) => {
      mocks.find.mockResolvedValue({ docs: [product(mode)] })
      expect((await getProductBySlug('tea'))?.inquiry).toEqual({
        buttons: [button('Default').link],
      })
      expect(mocks.cache.get(JSON.stringify(['product-detail', 'product']))).toEqual(product(mode))
      mocks.settings.mockResolvedValue({ product: { inquiry: { buttons: [button('Updated')] } } })
      expect((await getProductBySlug('tea'))?.inquiry).toEqual({
        buttons: [button('Updated').link],
      })
      expect(mocks.settings).toHaveBeenCalledTimes(2)
      expect(mocks.find.mock.calls.filter(([args]) => args.depth === 2)).toHaveLength(1)
      expect(mocks.find.mock.calls.filter(([args]) => args.depth === 0)).toHaveLength(2)
      expect(productDetailPopulate).toMatchObject({ pages: { slug: true }, posts: { slug: true } })
    },
  )
  it.each(['custom', 'hidden'])(
    'skips Settings reads for public and draft %s products',
    async (mode) => {
      mocks.find.mockResolvedValue({ docs: [product(mode)] })
      mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
      for (const draft of [false, true]) {
        expect((await getProductBySlug('tea', { draft }))?.inquiry).toEqual({
          buttons: mode === 'custom' ? [button('Custom').link] : [],
        })
      }
      expect(mocks.settings).not.toHaveBeenCalled()
    },
  )
  it('resolves defaults for authorized drafts outside the product cache', async () => {
    mocks.find.mockResolvedValue({ docs: [product('default')] })
    mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
    expect((await getProductBySlug('tea', { draft: true }))?.inquiry.buttons[0].label).toBe(
      'Default',
    )
    expect(mocks.cache.size).toBe(0)
    expect(mocks.settings).toHaveBeenCalledOnce()
  })
  it('does not load Settings for a missing product', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    expect(await getProductBySlug('missing')).toBeNull()
    expect(mocks.settings).not.toHaveBeenCalled()
  })
  it('keeps the one-argument detail normalizer compatible with missing Settings', () => {
    expect(toProductDetail(product('default') as never).inquiry).toEqual({ buttons: [] })
    expect(toProductDetail(product('custom') as never).inquiry).toEqual({
      buttons: [button('Custom').link],
    })
  })
})
