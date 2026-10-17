// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { Documents } from '@/collections/Documents'

const original = {
  id: 'doc-1',
  url: 'https://files.example.invalid/documents/report.pdf',
  filename: '茶叶检测报告.pdf',
  mimeType: 'application/pdf',
}
const endpoint = () => {
  const found = Documents.endpoints && Documents.endpoints.find(({ path }) => path === '/:id/file')
  if (!found) throw new Error('Documents file endpoint missing')
  return found
}
function request({
  user = true,
  destination = '',
  url = original.url,
  mimeType = original.mimeType,
} = {}) {
  const findByID = vi.fn(async () => ({ ...original, url, mimeType }))
  return {
    req: {
      user: user ? { id: 'user' } : undefined,
      routeParams: { id: original.id },
      headers: new Headers(destination ? { 'Sec-Fetch-Dest': destination } : {}),
      payload: {
        findByID,
        config: { serverURL: 'http://localhost:3000', routes: { api: '/api' } },
      },
    } as unknown as PayloadRequest,
    findByID,
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('Documents same-origin original file endpoint', () => {
  it('registers a native thumbnail URL for PDF and Office without changing original preview configuration', () => {
    expect(typeof Documents.upload === 'object' && Documents.upload.adminThumbnail).toBeTypeOf(
      'function',
    )
    if (
      typeof Documents.upload !== 'object' ||
      typeof Documents.upload.adminThumbnail !== 'function'
    )
      return
    for (const mimeType of [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])
      expect(Documents.upload.adminThumbnail({ doc: { id: 'doc 1', mimeType } })).toMatch(
        /\/api\/documents\/doc%201\/file$/,
      )
    expect(Documents.upload).not.toHaveProperty('imageSizes')
  })
  it('authenticates before inspecting any file, and returns 404 for image destinations', async () => {
    const { req, findByID } = request({ user: false })
    expect((await endpoint().handler(req)).status).toBe(401)
    expect(findByID).not.toHaveBeenCalled()
    const image = request({ destination: 'image' })
    expect((await endpoint().handler(image.req)).status).toBe(404)
    expect(image.findByID).not.toHaveBeenCalled()
  })
  it.each(['', 'document', 'empty'])(
    'streams original bytes for destination %s, preserving stored MIME and UTF-8 filename',
    async (destination) => {
      vi.stubEnv('R2_PUBLIC_URL', 'https://files.example.invalid/documents')
      const fetch = vi.fn(
        async () =>
          new Response('original bytes', { headers: { 'Content-Type': 'wrong/upstream' } }),
      )
      vi.stubGlobal('fetch', fetch)
      const { req, findByID } = request({
        destination,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const response = await endpoint().handler(req)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('original bytes')
      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      expect(response.headers.get('Content-Disposition')).toBe(
        `inline; filename*=UTF-8''${encodeURIComponent(original.filename)}`,
      )
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(findByID).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'documents', id: 'doc-1', depth: 0, req }),
      )
      expect(fetch).toHaveBeenCalledWith(
        original.url,
        expect.objectContaining({ redirect: 'manual', cache: 'no-store' }),
      )
    },
  )
  it.each([
    'https://files.example.invalid.evil/documents/report.pdf',
    'https://files.example.invalid/documents-evil/report.pdf',
    'https://files.example.invalid/documents/../private.pdf',
    'https://files.example.invalid/documents/%2e%2e/private.pdf',
    'https://user:pass@files.example.invalid/documents/report.pdf',
    'http://files.example.invalid/documents/report.pdf',
    'http://127.0.0.1/internal',
    '/api/documents/file/report.pdf',
  ])('rejects an untrusted original URL %s without fetching', async (url) => {
    vi.stubEnv('R2_PUBLIC_URL', 'https://files.example.invalid/documents')
    vi.stubEnv('DISABLE_R2_STORAGE', 'false')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await endpoint().handler(request({ url }).req)).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([301, 302, 307, 404, 500, 206])(
    'maps upstream %s to 502 and does not follow redirects',
    async (status) => {
      vi.stubEnv('R2_PUBLIC_URL', 'https://files.example.invalid/documents')
      const fetch = vi.fn(
        async () =>
          new Response(null, { status, headers: { Location: 'http://127.0.0.1/private' } }),
      )
      vi.stubGlobal('fetch', fetch)
      expect((await endpoint().handler(request().req)).status).toBe(502)
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        original.url,
        expect.objectContaining({ redirect: 'manual' }),
      )
    },
  )
  it('maps network failures to 502', async () => {
    vi.stubEnv('R2_PUBLIC_URL', 'https://files.example.invalid/documents')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network')
      }),
    )
    expect((await endpoint().handler(request().req)).status).toBe(502)
  })
  it('allows only native Documents file paths in explicit local storage mode', async () => {
    vi.stubEnv('DISABLE_R2_STORAGE', 'true')
    const fetch = vi.fn(async () => new Response('local'))
    vi.stubGlobal('fetch', fetch)
    for (const url of [
      'http://localhost:3000/api/documents/file/report.pdf',
      '/api/documents/file/report.pdf',
    ]) {
      expect((await endpoint().handler(request({ url }).req)).status).toBe(200)
      expect(fetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/api/documents/file/report.pdf',
        expect.anything(),
      )
    }
    for (const url of [
      'http://localhost:3000/api/documents/doc-1/file',
      '/api/documents/file/../doc-1/file',
      '/api/media/file/report.pdf',
      'http://localhost:3000/private',
      '//evil.invalid/api/documents/file/report.pdf',
      '/api/documents/file/report%2fsecret.pdf',
    ]) {
      fetch.mockClear()
      expect((await endpoint().handler(request({ url }).req)).status).toBe(403)
      expect(fetch).not.toHaveBeenCalled()
    }
  })
})

it('never recursively proxies the file endpoint even when the configured public origin is the site origin', async () => {
  vi.stubEnv('R2_PUBLIC_URL', 'http://localhost:3000')
  vi.stubEnv('DISABLE_R2_STORAGE', 'true')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  expect(
    (
      await endpoint().handler(
        request({ url: 'http://localhost:3000/api/documents/doc-1/file' }).req,
      )
    ).status,
  ).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})
