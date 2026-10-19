import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { mediaFileEndpoint } from '@/collections/mediaEndpoints/file'
import { Media } from '@/collections/Media'

const doc = {
  id: '123',
  url: 'https://media.example.invalid/library/tea.jpg',
  filename: '茶园.jpg',
  mimeType: 'image/jpeg',
}
const findByID = vi.fn()
const fetchMock = vi.fn()
const request = (dest?: string, user: unknown = { id: 'editor' }) =>
  ({
    user,
    routeParams: { id: '123' },
    headers: new Headers(dest ? { 'Sec-Fetch-Dest': dest } : {}),
    payload: { findByID, config: { serverURL: 'http://localhost:3000', routes: { api: '/api' } } },
  }) as unknown as PayloadRequest

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
const setup = () => {
  vi.stubEnv('R2_PUBLIC_URL', 'https://media.example.invalid/library')
  vi.stubEnv('DISABLE_R2_STORAGE', 'false')
  findByID.mockResolvedValue(doc)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
}

describe('same-origin Media file endpoint', () => {
  it('keeps native file links on the admin origin for images and videos', () => {
    const upload = Media.upload
    if (typeof upload !== 'object' || typeof upload.adminThumbnail !== 'function')
      throw new Error('thumbnail missing')
    for (const mimeType of ['image/jpeg', 'video/mp4']) {
      expect(upload.adminThumbnail({ doc: { ...doc, mimeType } } as never)).toBe(
        'http://localhost:3000/api/media/123/file',
      )
    }
  })
  it('requires authentication before reading the record', async () => {
    setup()
    expect((await mediaFileEndpoint.handler(request(undefined, null))).status).toBe(401)
    expect(findByID).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('returns 404 for a missing record', async () => {
    setup()
    findByID.mockResolvedValue(null)
    expect((await mediaFileEndpoint.handler(request())).status).toBe(404)
  })
  it('streams original bytes with an inline UTF-8 filename and no shared cache', async () => {
    setup()
    const response = await mediaFileEndpoint.handler(request())
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: '123', depth: 0 }),
    )
    expect(fetchMock).toHaveBeenCalledWith(doc.url, expect.objectContaining({ redirect: 'manual' }))
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(response.headers.get('Content-Disposition')).toBe(
      "inline; filename*=UTF-8''%E8%8C%B6%E5%9B%AD.jpg",
    )
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3])
  })
  it('redirects image previews to 1200px scale-down without fetching bytes', async () => {
    setup()
    const response = await mediaFileEndpoint.handler(request('image'))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toContain('/cdn-cgi/image/width=1200,fit=scale-down')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('redirects video image previews to a Cloudflare frame without fetching bytes', async () => {
    setup()
    findByID.mockResolvedValue({ ...doc, mimeType: 'video/mp4' })
    const response = await mediaFileEndpoint.handler(request('image'))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toContain(
      '/cdn-cgi/media/mode=frame,time=1s,width=1200,fit=scale-down/',
    )
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('keeps local video previews on the default file icon', async () => {
    setup()
    vi.stubEnv('DISABLE_R2_STORAGE', 'true')
    findByID.mockResolvedValue({ ...doc, url: '/api/media/file/clip.mp4', mimeType: 'video/mp4' })
    expect((await mediaFileEndpoint.handler(request('image'))).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each([
    'https://media.example.invalid.evil.test/library/x.jpg',
    'https://media.example.invalid/library-evil/x.jpg',
    'https://media.example.invalid/library/../secret.jpg',
    'https://user:pass@media.example.invalid/library/x.jpg',
    'file:///library/x.jpg',
    'http://127.0.0.1/library/x.jpg',
  ])('rejects an untrusted source %s', async (url) => {
    setup()
    findByID.mockResolvedValue({ ...doc, url })
    expect((await mediaFileEndpoint.handler(request())).status).toBe(502)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('rejects redirects without following an untrusted location', async () => {
    setup()
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }),
    )
    expect((await mediaFileEndpoint.handler(request())).status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it.each([403, 404, 500, 206])('maps upstream status %s to 502', async (status) => {
    setup()
    fetchMock.mockResolvedValue(new Response(null, { status }))
    expect((await mediaFileEndpoint.handler(request())).status).toBe(502)
  })
  it('maps upstream transport failure to 502', async () => {
    setup()
    fetchMock.mockRejectedValue(new Error('offline'))
    expect((await mediaFileEndpoint.handler(request())).status).toBe(502)
  })
  it('allows only same-origin native local file paths when storage is disabled', async () => {
    setup()
    vi.stubEnv('DISABLE_R2_STORAGE', 'true')
    for (const url of ['/api/media/file/tea.jpg', 'http://localhost:3000/api/media/file/tea.jpg']) {
      findByID.mockResolvedValue({ ...doc, url })
      expect((await mediaFileEndpoint.handler(request())).status).toBe(200)
    }
    for (const url of [
      '/api/media/123/file',
      'http://evil.test/api/media/file/tea.jpg',
      '/api/media/file/../123/file',
      '/other/file/tea.jpg',
    ]) {
      findByID.mockResolvedValue({ ...doc, url })
      expect((await mediaFileEndpoint.handler(request())).status).toBe(502)
    }
  })
})

it('mounts crop controls before selection and in a stable public UI field', () => {
  const upload = Media.upload
  if (typeof upload !== 'object') throw new Error('upload missing')
  expect(upload.admin?.components?.controls).toContain(
    '@/collections/mediaAdmin/ImageCropControls#ImageCropControls',
  )
  expect(Media.fields).toContainEqual(
    expect.objectContaining({
      name: 'imageCrop',
      type: 'ui',
      admin: expect.objectContaining({
        components: { Field: '@/collections/mediaAdmin/ImageCropControls#ImageCropControls' },
      }),
    }),
  )
})
