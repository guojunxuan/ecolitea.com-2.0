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
      buildMediaInventory(
        [
          {
            id: 'b',
            filename: 'b.jpg',
            sizes: { thumbnail: { filename: 'b-300x300.jpg' }, empty: {} },
            url: 'https://media-dev.example.com/b.jpg',
          },
          { id: 'a', filename: 'a.pdf', url: 'https://media-dev.example.com/a.pdf' },
        ],
        'https://media-dev.example.com',
      ),
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

  it('discovers references in every current, versioned/draft, and search source', async () => {
    const payload = fakePayload({
      collections: {
        'case-studies': [{ id: 'case-1', hero: { media: 'm1' } }],
        pages: [{ id: 'page-1', layout: [{ media: { id: 'm2' } }] }],
        posts: [{ id: 'post-1', heroImage: 'm3' }],
        search: [{ id: 'search-1', meta: { image: 'm7' } }],
      },
      versions: {
        'case-studies': [{ id: 'case-version', version: { meta: { image: 'm4' } } }],
        pages: [{ id: 'page-version', version: { meta: { image: 'm5' } } }],
        posts: [{ id: 'post-version', version: { heroImage: 'm6', _status: 'draft' } }],
      },
    })

    const references = await findMediaReferences(payload, [
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
      'm7',
    ])

    expect(references.map(({ source }) => source)).toEqual([
      'case-studies:current',
      'case-studies:version',
      'pages:current',
      'pages:version',
      'posts:current',
      'posts:version',
      'search:current',
    ])
    expect(references.flatMap(({ mediaIDs }) => mediaIDs)).toEqual([
      'm1',
      'm4',
      'm2',
      'm5',
      'm3',
      'm6',
      'm7',
    ])
    expect(payload.find.mock.calls.map(([call]) => call.collection)).toEqual([
      'case-studies',
      'pages',
      'posts',
      'search',
    ])
    expect(payload.findVersions.mock.calls.map(([call]) => call.collection)).toEqual([
      'case-studies',
      'pages',
      'posts',
    ])
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
        media: [mediaDocument('m1', 'one.jpg'), mediaDocument('m2', 'two.jpg')],
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
        media: [mediaDocument('m2', 'two.jpg'), mediaDocument('m1', 'one.jpg')],
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
    expect(() => buildMediaInventory([null], 'https://media-dev.example.com')).toThrow(
      /incomplete media inventory/i,
    )
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
      collections: { media: [mediaDocument('m1', 'one.jpg')] },
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

  it.each([
    { id: 'm1', url: 'https://media-dev.example.com/one.jpg' },
    { filename: '', id: 'm1', url: 'https://media-dev.example.com/one.jpg' },
    { filename: 'one.jpg', id: 'm1' },
    { filename: 'one.jpg', id: 'm1', url: '' },
    { filename: 'one.jpg', id: 'm1', url: 'not-a-url' },
    { filename: 'one.jpg', id: 'm1', url: 'https://other.example.com/one.jpg' },
  ])('refuses incomplete or out-of-origin original metadata before deletion: %j', async (media) => {
    const payload = fakePayload({ collections: { media: [media] } })

    await expect(
      runMediaCleanup({
        configuredOrigin: 'https://media-dev.example.com',
        execute: true,
        expectedOrigin: 'https://media-dev.example.com',
        payload,
      }),
    ).rejects.toThrow(/incomplete media inventory|outside configured R2 origin/i)
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

function mediaDocument(id: string, filename: string) {
  return { id, filename, url: `https://media-dev.example.com/${filename}` }
}
