import { describe, expect, it, vi } from 'vitest'

import {
  buildMediaInventory,
  findMediaReferences,
  normalizeHTTPOrigin,
  parseCleanupArguments,
  runMediaCleanup,
} from '../../scripts/cleanup-development-media'

describe('development Media cleanup safety', () => {
  it('parses dry-run by default and rejects unknown or malformed arguments', () => {
    expect(
      parseCleanupArguments(['--', '--expected-origin=https://media-dev.example.com/']),
    ).toEqual({
      execute: false,
      expectedOrigin: 'https://media-dev.example.com/',
    })
    expect(() => parseCleanupArguments(['--execute'])).toThrow(/expected-origin/i)
    expect(() => parseCleanupArguments(['--expected-origin'])).toThrow(/malformed/i)
    expect(() =>
      parseCleanupArguments(['--expected-origin=https://media-dev.example.com', '--unknown']),
    ).toThrow(/unknown/i)
  })

  it('normalizes HTTP origins and rejects other URL schemes', () => {
    expect(normalizeHTTPOrigin('https://media-dev.example.com/path/')).toBe(
      'https://media-dev.example.com',
    )
    expect(() => normalizeHTTPOrigin('s3://bucket')).toThrow(/HTTP/i)
    expect(() => normalizeHTTPOrigin('not a url')).toThrow(/valid URL/i)
  })

  it('builds a deterministic inventory with raw legacy size filenames', () => {
    expect(
      buildMediaInventory([
        {
          id: 'b',
          filename: 'b.jpg',
          sizes: { thumbnail: { filename: 'b-300x300.jpg' }, empty: {} },
          url: 'https://media-dev.example.com/b.jpg',
        },
        { id: 'a', filename: 'a.pdf', url: 'https://media-dev.example.com/a.pdf' },
      ]),
    ).toEqual([
      {
        filename: 'a.pdf',
        id: 'a',
        legacySizeFilenames: [],
        url: 'https://media-dev.example.com/a.pdf',
      },
      {
        filename: 'b.jpg',
        id: 'b',
        legacySizeFilenames: ['b-300x300.jpg'],
        url: 'https://media-dev.example.com/b.jpg',
      },
    ])
  })

  it('discovers references in current docs, versions/drafts, and search docs', async () => {
    const payload = fakePayload({
      collections: {
        'case-studies': [{ id: 'case-1', hero: { media: 'm1' } }],
        pages: [{ id: 'page-1', layout: [{ media: { id: 'm2' } }] }],
        posts: [],
        search: [{ id: 'search-1', meta: { image: 'm3' } }],
      },
      versions: {
        'case-studies': [],
        pages: [{ id: 'version-1', version: { meta: { image: 'm1' } } }],
        posts: [{ id: 'version-2', version: { heroImage: 'm2', _status: 'draft' } }],
      },
    })

    const references = await findMediaReferences(payload, ['m1', 'm2', 'm3'])

    expect(references.map(({ source }) => source)).toEqual([
      'case-studies:current',
      'pages:current',
      'pages:version',
      'posts:version',
      'search:current',
    ])
    expect(references.flatMap(({ mediaIDs }) => mediaIDs)).toEqual(['m1', 'm2', 'm1', 'm2', 'm3'])
  })

  it('refuses an origin mismatch before querying and never touches brand-assets', async () => {
    const payload = fakePayload({ collections: { media: [] } })

    await expect(
      runMediaCleanup({
        configuredOrigin: 'https://other.example.com',
        expectedOrigin: 'https://media-dev.example.com',
        payload,
      }),
    ).rejects.toThrow(/does not match/i)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('inventories only media and does not mutate in dry-run mode', async () => {
    const payload = fakePayload({
      collections: {
        media: [{ id: 'm1', filename: 'one.jpg', url: 'https://media-dev.example.com/one.jpg' }],
      },
    })

    const report = await runMediaCleanup({
      configuredOrigin: 'https://media-dev.example.com/',
      expectedOrigin: 'https://media-dev.example.com',
      payload,
    })

    expect(report.mode).toBe('dry-run')
    expect(payload.find.mock.calls.map(([call]) => call.collection)).not.toContain('brand-assets')
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('aborts all deletion when any reference remains', async () => {
    const payload = fakePayload({
      collections: {
        media: [
          { id: 'm1', filename: 'one.jpg' },
          { id: 'm2', filename: 'two.jpg' },
        ],
        pages: [{ id: 'page-1', meta: { image: 'm2' } }],
      },
    })

    const blocked = runMediaCleanup({
      configuredOrigin: 'https://media-dev.example.com',
      execute: true,
      expectedOrigin: 'https://media-dev.example.com/',
      payload,
    })
    await expect(blocked).rejects.toThrow(/references remain/i)
    await expect(blocked).rejects.toMatchObject({
      report: {
        inventory: expect.arrayContaining([expect.objectContaining({ id: 'm2' })]),
        references: expect.arrayContaining([
          expect.objectContaining({ documentID: 'page-1', mediaIDs: ['m2'] }),
        ]),
      },
    })
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('deletes through Payload only after all reference checks complete', async () => {
    const payload = fakePayload({
      collections: {
        media: [
          { id: 'm2', filename: 'two.jpg' },
          { id: 'm1', filename: 'one.jpg' },
        ],
      },
    })

    const result = await runMediaCleanup({
      configuredOrigin: 'https://media-dev.example.com',
      execute: true,
      expectedOrigin: 'https://media-dev.example.com',
      payload,
    })

    expect(result.mode).toBe('execute')
    expect(payload.delete).toHaveBeenCalledTimes(1)
    expect(payload.delete).toHaveBeenCalledWith({
      collection: 'media',
      context: { disableRevalidate: true },
      where: { id: { in: ['m1', 'm2'] } },
    })
    expect(payload.findVersions).toHaveBeenCalledTimes(3)
  })

  it('does not delete when inspection fails and treats an empty inventory as success', async () => {
    const failing = fakePayload({ collections: { media: [] } })
    failing.find.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(
      runMediaCleanup({
        configuredOrigin: 'https://media-dev.example.com',
        execute: true,
        expectedOrigin: 'https://media-dev.example.com',
        payload: failing,
      }),
    ).rejects.toThrow('database unavailable')
    expect(failing.delete).not.toHaveBeenCalled()

    const empty = fakePayload({ collections: { media: [] } })
    const result = await runMediaCleanup({
      configuredOrigin: 'https://media-dev.example.com',
      execute: true,
      expectedOrigin: 'https://media-dev.example.com',
      payload: empty,
    })
    expect(result.inventory).toEqual([])
    expect(empty.delete).not.toHaveBeenCalled()
  })

  it('refuses an incomplete media inventory before any deletion', async () => {
    expect(() => buildMediaInventory([null])).toThrow(/incomplete media inventory/i)
    const payload = fakePayload({
      collections: { media: [null, { filename: 'missing-id.jpg' }] },
    })

    await expect(
      runMediaCleanup({
        configuredOrigin: 'https://media-dev.example.com',
        execute: true,
        expectedOrigin: 'https://media-dev.example.com',
        payload,
      }),
    ).rejects.toThrow(/incomplete media inventory/i)
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it('refuses incomplete reference records instead of treating them as clear', async () => {
    const payload = fakePayload({
      collections: { media: [{ id: 'm1' }] },
      versions: { pages: [{ id: 'broken-version' }] },
    })

    await expect(
      runMediaCleanup({
        configuredOrigin: 'https://media-dev.example.com',
        execute: true,
        expectedOrigin: 'https://media-dev.example.com',
        payload,
      }),
    ).rejects.toThrow(/incomplete reference inspection/i)
    expect(payload.delete).not.toHaveBeenCalled()
  })
})

type FakeData = {
  collections?: Record<string, unknown[]>
  versions?: Record<string, unknown[]>
}

function fakePayload({ collections = {}, versions = {} }: FakeData) {
  const page = (docs: unknown[]) => ({ docs, hasNextPage: false, nextPage: null })
  return {
    delete: vi.fn(async () => ({ docs: [], errors: [] })),
    find: vi.fn(async ({ collection }: { collection: string }) =>
      page(collections[collection] ?? []),
    ),
    findVersions: vi.fn(async ({ collection }: { collection: string }) =>
      page(versions[collection] ?? []),
    ),
  }
}
