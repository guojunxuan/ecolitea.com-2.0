import { beforeEach, describe, expect, it, vi } from 'vitest'
const read = vi.hoisted(() => vi.fn())
vi.mock('@/i18n/config', async () => ({ ...await vi.importActual('@/i18n/config'), publicLocales: [{ code: 'en' }, { code: 'de' }] }))
vi.mock('@/utilities/i18n/getDocumentBySlug', () => ({ getDocumentBySlug: read }))
vi.mock('@/utilities/i18n/pageAccess', () => ({ legalPagePaths: async () => ['/privacy'] }))
vi.mock('@/utilities/blogs/getBlogBySlug', () => ({ getBlogBySlug: vi.fn() }))
vi.mock('@/utilities/products/getProductBySlug', () => ({ getProductBySlug: vi.fn() }))
vi.mock('@/utilities/products/getProductCategoryBySlug', () => ({ getProductCategoryBySlug: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
import { GET } from '@/app/(frontend)/next/language-target/route'
const request = (path: string, locale = 'de') => new Request(`https://site.example.invalid/next/language-target?${new URLSearchParams({ path, locale })}`)
beforeEach(() => read.mockReset())
describe('public language switch destination', () => {
  it('uses the same path when ready, locale home when unavailable', async () => {
    read.mockResolvedValue({ id: 'a' })
    expect(await (await GET(request('/about'))).json()).toEqual({ href: '/de/about' })
    read.mockResolvedValue(null)
    expect(await (await GET(request('/about'))).json()).toEqual({ href: '/de?unavailable=de' })
  })
  it('keeps legal paths English and rejects unsupported locales or external paths', async () => {
    expect(await (await GET(request('/de/privacy'))).json()).toEqual({ href: '/privacy' })
    expect((await GET(request('//evil.invalid'))).status).toBe(400)
    expect((await GET(request('/%ZZ'))).status).toBe(400)
    expect((await GET(request('/about', 'xx'))).status).toBe(400)
  })
})
