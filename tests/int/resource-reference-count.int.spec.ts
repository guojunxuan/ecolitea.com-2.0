import { expect, it, vi } from 'vitest'
import { mediaReferencesEndpoint } from '@/collections/mediaEndpoints/references'
import { documentReferencesEndpoint } from '@/collections/Documents/endpoints/references'

it.each([mediaReferencesEndpoint, documentReferencesEndpoint])(
  'counts older versions rather than matching fields in $path',
  async (endpoint) => {
    const page = (docs: unknown[]) => ({
      docs,
      totalDocs: docs.length,
      totalPages: 1,
      page: 1,
      hasNextPage: false,
    })
    const req = {
      user: { id: 'editor' },
      routeParams: { id: 'resource-1' },
      payload: {
        config: {
          routes: { admin: '/admin' },
          collections: [{ slug: 'blogs', versions: true }],
          globals: [{ slug: 'header', versions: true }],
        },
        find: vi.fn(async () => page([])),
        findVersions: vi.fn(async () =>
          page([
            {
              id: 'version-1',
              parent: 'blog-1',
              version: { hero: 'resource-1', body: { image: 'resource-1' } },
            },
            { id: 'version-2', parent: 'blog-1', version: { hero: 'resource-1' } },
          ]),
        ),
        findGlobal: vi.fn(async () => ({})),
        findGlobalVersions: vi.fn(async () =>
          page([{ id: 'version-1', version: { hero: 'resource-1', footer: 'resource-1' } }]),
        ),
      },
    }
    const response = await endpoint.handler(req as never)
    expect(await response.json()).toMatchObject({ historicalCount: 3, current: [] })
  },
)
