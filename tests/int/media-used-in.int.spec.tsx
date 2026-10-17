import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { UsedInPanel } from '@/collections/mediaAdmin/UsedInPanel'
vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => ({ id: 'media-1' }),
  useConfig: () => ({ config: { routes: { api: '/api' }, serverURL: '' } }),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('shows current owner edit links and historical count from the authenticated endpoint', async () => {
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      current: [
        {
          mediaID: 'media-1',
          ownerType: 'collection',
          ownerSlug: 'blogs',
          kind: 'current',
          documentID: 'blog-1',
          title: 'Tea story',
          path: 'heroImage',
          editURL: '/admin/collections/blogs/blog-1',
        },
      ],
      historicalCount: 3,
    }),
  }))
  vi.stubGlobal('fetch', fetch)
  render(<UsedInPanel />)
  const link = await screen.findByRole('link', { name: /Tea story.*heroImage/ })
  expect(link.getAttribute('href')).toBe('/admin/collections/blogs/blog-1')
  expect(screen.getByText(/3 historical references/)).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith(
    '/api/media/media-1/references',
    expect.objectContaining({ credentials: 'same-origin', signal: expect.any(AbortSignal) }),
  )
})
it('reports failed inspection without presenting the media as unused', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false })),
  )
  render(<UsedInPanel />)
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Unable to load media references.',
  )
  expect(screen.queryByText('No current references.')).toBeNull()
})
