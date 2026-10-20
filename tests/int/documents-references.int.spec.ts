// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import { Documents } from '@/collections/Documents'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

import { findDocumentReferences } from '@/collections/Documents/references'
const page = (docs: unknown[], extra = {}) => ({
  docs,
  totalDocs: docs.length,
  totalPages: 1,
  page: 1,
  hasNextPage: false,
  nextPage: null,
  ...extra,
})
function fakePayload() {
  return {
    config: {
      routes: { admin: '/manage' },
      collections: [
        { slug: 'documents', versions: true },
        { slug: 'blogs', versions: true, admin: { useAsTitle: 'title' } },
        { slug: 'future-content', versions: false },
      ],
      globals: [
        { slug: 'header', versions: true },
        { slug: 'settings', versions: false },
      ],
    },
    find: vi.fn(async ({ collection }) =>
      page(
        collection === 'blogs'
          ? [
              {
                id: 'blog-1',
                title: 'Tea story',
                heroImage: 12,
                nested: [{ localized: { en: '12', zh: 'other' } }],
              },
            ]
          : [],
      ),
    ),
    findVersions: vi.fn(async () =>
      page([{ id: 'v1', parent: 'blog-1', version: { title: 'Earlier story', heroImage: '12' } }]),
    ),
    findGlobal: vi.fn(async ({ slug }) =>
      slug === 'header'
        ? { navItems: [{ label: 'Tea', image: '12' }] }
        : { blog: { hero: { image: 12 } } },
    ),
    findGlobalVersions: vi.fn(async () => page([{ id: 'gv1', version: { image: '12' } }])),
  }
}

describe('independent Documents reference scanner', () => {
  it('dynamically discovers every current/version collection/global, nested locales and normalized IDs', async () => {
    const payload = fakePayload()
    const req = { context: {} }
    const references = await findDocumentReferences(
      payload as unknown as Payload,
      [12],
      req as never,
    )
    expect(references).toHaveLength(6)
    expect(references).toContainEqual({
      documentID: '12',
      kind: 'current',
      ownerType: 'collection',
      ownerSlug: 'blogs',
      ownerDocumentID: 'blog-1',
      title: 'Tea story',
      path: 'heroImage',
      editURL: '/manage/collections/blogs/blog-1',
    })
    expect(references).toContainEqual(expect.objectContaining({ path: 'nested[0].localized.en' }))
    expect(references).toContainEqual(
      expect.objectContaining({
        kind: 'version',
        ownerDocumentID: 'blog-1',
        editURL: '/manage/collections/blogs/blog-1',
      }),
    )
    expect(references).toContainEqual(
      expect.objectContaining({
        ownerType: 'global',
        ownerSlug: 'header',
        path: 'navItems[0].image',
        editURL: '/manage/globals/header',
      }),
    )
    expect(references).toContainEqual(
      expect.objectContaining({ ownerSlug: 'settings', path: 'blog.hero.image' }),
    )
    expect(payload.find.mock.calls.map(([args]) => args.collection)).toEqual([
      'blogs',
      'future-content',
    ])
    expect(payload.findVersions).toHaveBeenCalledTimes(1)
    expect(payload.findGlobalVersions).toHaveBeenCalledTimes(1)
    for (const query of [
      payload.find,
      payload.findVersions,
      payload.findGlobal,
      payload.findGlobalVersions,
    ]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 0,
          locale: 'all',
          overrideAccess: true,
          showHiddenFields: true,
          req,
        }),
      )
    }
  })
  it('fully paginates collections and both types of versions', async () => {
    const payload = fakePayload()
    const results = (currentPage: number) =>
      currentPage === 1
        ? page([{ id: '1', parent: 'owner', version: { image: '12' }, image: '12' }], {
            hasNextPage: true,
            nextPage: 2,
            totalDocs: 2,
            totalPages: 2,
          })
        : page([{ id: '2', parent: 'owner', version: { image: '12' }, image: '12' }], {
            page: 2,
            totalDocs: 2,
            totalPages: 2,
          })
    payload.find.mockImplementation(async (args) => results((args as { page?: number }).page!))
    payload.findVersions.mockImplementation(async (args?: unknown) =>
      results((args as { page: number }).page),
    )
    payload.findGlobalVersions.mockImplementation(async (args?: unknown) =>
      results((args as { page: number }).page),
    )
    const references = await findDocumentReferences(payload as unknown as Payload, ['12'])
    expect(
      references.filter(({ ownerSlug, kind }) => ownerSlug === 'blogs' && kind === 'current'),
    ).toHaveLength(4)
    expect(payload.findVersions).toHaveBeenCalledTimes(2)
    expect(payload.findGlobalVersions).toHaveBeenCalledTimes(2)
  })
  it.each([
    page([], { hasNextPage: true, nextPage: null }),
    page([], { hasNextPage: false, totalDocs: 4, totalPages: 2 }),
    { docs: [], totalDocs: 0 },
    page([null]),
  ])('fails closed for incomplete pagination or records: %j', async (result) => {
    const payload = fakePayload()
    payload.find.mockResolvedValue(result as never)
    await expect(findDocumentReferences(payload as unknown as Payload, ['12'])).rejects.toThrow(
      /incomplete reference inspection/i,
    )
  })
  it('propagates source read failures and rejects missing version data', async () => {
    const payload = fakePayload()
    payload.find.mockRejectedValueOnce(new Error('source unavailable'))
    await expect(findDocumentReferences(payload as unknown as Payload, ['12'])).rejects.toThrow(
      'source unavailable',
    )
    payload.findVersions.mockResolvedValueOnce(page([{ id: 'broken' }]))
    await expect(findDocumentReferences(payload as unknown as Payload, ['12'])).rejects.toThrow(
      /incomplete reference inspection/i,
    )
  })
  it('ignores only Payload operational locks and preferences while inspecting hidden content collections', async () => {
    const payload = fakePayload()
    payload.config.collections = [
      { slug: 'payload-locked-documents', versions: false },
      { slug: 'payload-preferences', versions: false },
      { slug: 'payload-custom-content', versions: false, admin: { hidden: true } },
    ] as never
    payload.config.globals = []
    payload.find.mockImplementation(async ({ collection }) =>
      page(
        collection === 'payload-locked-documents'
          ? [{ id: 'lock', document: { relationTo: 'documents', value: '12' } }]
          : collection === 'payload-preferences'
            ? [{ id: 'preference', value: { items: [{ id: '12' }] } }]
            : [],
      ),
    )
    expect(await findDocumentReferences(payload as unknown as Payload, ['12'])).toEqual([])
    expect(payload.find).toHaveBeenCalledTimes(1)
    payload.find.mockImplementation(async () => page([{ id: 'content', image: '12' }]))
    expect(await findDocumentReferences(payload as unknown as Payload, ['12'])).toEqual([
      expect.objectContaining({ ownerSlug: 'payload-custom-content', kind: 'current' }),
    ])
  })
  it('rejects duplicate documents across pages instead of assuming inspection was complete', async () => {
    const payload = fakePayload()
    payload.find.mockImplementation(async (args) =>
      page([{ id: 'same-id' }], {
        page: (args as { page?: number }).page,
        totalDocs: 2,
        totalPages: 2,
        hasNextPage: (args as { page?: number }).page === 1,
        nextPage: (args as { page?: number }).page === 1 ? 2 : null,
      }),
    )
    await expect(findDocumentReferences(payload as unknown as Payload, ['12'])).rejects.toThrow(
      /incomplete reference inspection/i,
    )
  })
  it('refuses deletion when a reference source cannot be inspected', async () => {
    const payload = fakePayload()
    payload.find.mockRejectedValue(new Error('Source unavailable'))
    const beforeDelete = Documents.hooks?.beforeDelete?.[0]
    if (!beforeDelete) throw new Error('Delete hook missing')
    await expect(beforeDelete({ id: 12, req: { payload } } as never)).rejects.toThrow(
      'Source unavailable',
    )
    payload.find.mockResolvedValue(page([], { hasNextPage: false, totalDocs: 2, totalPages: 2 }))
    await expect(beforeDelete({ id: 12, req: { payload } } as never)).rejects.toThrow(
      /incomplete reference inspection/i,
    )
  })
  it('fully paginates and deduplicates stored/draft locations with all locales and trash included', async () => {
    const payload = fakePayload()
    payload.config.collections = [
      { slug: 'blogs', versions: { drafts: { autosave: true } } },
    ] as never
    payload.config.globals = []
    payload.find.mockImplementation(async (args) => {
      const { page: currentPage, draft } = args as { page: number; draft?: boolean }
      return page(
        [{ id: `owner-${currentPage}`, image: '12', ...(draft ? { draftImage: '12' } : {}) }],
        {
          page: currentPage,
          totalDocs: 2,
          totalPages: 2,
          hasNextPage: currentPage === 1,
          nextPage: currentPage === 1 ? 2 : null,
        },
      )
    })
    payload.findVersions.mockResolvedValue(page([]))
    const current = (await findDocumentReferences(payload as unknown as Payload, ['12'])).filter(
      (ref) => ref.kind === 'current',
    )
    expect(current).toHaveLength(4)
    expect(payload.find).toHaveBeenCalledTimes(4)
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, page: 2, locale: 'all', trash: true }),
    )
  })
  it('fails closed when the latest collection or Global draft cannot be inspected', async () => {
    const payload = fakePayload()
    payload.config.collections = [{ slug: 'blogs', versions: { drafts: true } }] as never
    payload.find.mockImplementation(async (args) =>
      (args as { draft?: boolean }).draft ? page([], { totalDocs: 1 }) : page([]),
    )
    await expect(findDocumentReferences(payload as unknown as Payload, ['12'])).rejects.toThrow(
      /incomplete reference inspection/i,
    )
    payload.config.collections = []
    payload.config.globals = [{ slug: 'header', versions: { drafts: true } }] as never
    payload.findGlobal.mockImplementation(async (args) => {
      if ((args as { draft?: boolean }).draft) throw new Error('Draft unavailable')
      return {} as never
    })
    await expect(findDocumentReferences(payload as unknown as Payload, ['12'])).rejects.toThrow(
      'Draft unavailable',
    )
  })
  it('does no queries for an empty ID list', async () => {
    const payload = fakePayload()
    expect(await findDocumentReferences(payload as unknown as Payload, [])).toEqual([])
    expect(payload.find).not.toHaveBeenCalled()
  })
  it('registers deletion protection and an authenticated reference endpoint', () => {
    expect(Documents.hooks?.beforeDelete).toHaveLength(1)
    expect(Documents.endpoints).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: 'get', path: '/:id/references' })]),
    )
  })
})

describe('Documents protection through the real Payload API', () => {
  let payload: Payload
  let documentID: string
  let cacheKey: string
  let databaseURI: string
  beforeAll(async () => {
    const databaseName = `ecolitea2-test-documents-references-${randomUUID().slice(0, 16)}`
    cacheKey = databaseName
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const url = createIsolatedTestDatabaseURI(
      databaseName,
      'mongodb://127.0.0.1:27017/ecolitea2-test',
    )
    databaseURI = url
    console.info(
      `Documents reference target: ${url}; DISABLE_R2_STORAGE=true; no storage plugins, local storage disabled`,
    )
    payload = await getPayload({
      key: databaseName,
      config: buildConfig({
        secret: 'isolated-reference-secret-at-least-32-characters',
        typescript: { autoGenerate: false },
        email: () => ({
          name: 'test',
          defaultFromAddress: 'test@example.invalid',
          defaultFromName: 'Test',
          sendEmail: async () => undefined,
        }),
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        localization: { locales: ['en', 'zh'], defaultLocale: 'en' },
        collections: [
          {
            slug: 'users',
            auth: {
              strategies: [
                {
                  name: 'fixture',
                  authenticate: async ({ headers }) =>
                    headers.get('x-test-user') === 'fixture'
                      ? {
                          user: {
                            id: 'fixture-user',
                            collection: 'users',
                            email: 'fixture@example.invalid',
                            createdAt: '',
                            updatedAt: '',
                          },
                        }
                      : { user: null },
                },
              ],
            },
            fields: [],
          },
          {
            ...Documents,
            fields: Documents.fields.filter((field) => 'name' in field && field.name === 'title'),
            upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
          },
          {
            slug: 'blogs',
            versions: { drafts: { autosave: true } },
            access: { read: () => false },
            admin: { hidden: true },
            fields: [
              { name: 'title', type: 'text' },
              { name: 'heroImage', type: 'upload', relationTo: 'documents', localized: true },
            ],
          },
        ],
        globals: [
          {
            slug: 'header',
            versions: { drafts: { autosave: true } },
            fields: [
              {
                name: 'navItems',
                type: 'array',
                fields: [{ name: 'image', type: 'upload', relationTo: 'documents' }],
              },
            ],
          },
          {
            slug: 'settings',
            fields: [{ name: 'image', type: 'upload', relationTo: 'documents' }],
          },
        ],
      }),
    })
    documentID = String(
      (await payload.create({ collection: 'documents', data: { title: 'Tea garden reference' } }))
        .id,
    )
  }, 15000)
  afterAll(async () => {
    if (payload) {
      console.info(`Dropping only isolated Documents reference database: ${databaseURI}`)
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })
  it('blocks single and bulk deletion including access-hidden localized references', async () => {
    const blog = await payload.create({
      collection: 'blogs',
      data: { title: 'Localized story', heroImage: documentID } as never,
      locale: 'zh' as never,
    })
    await expect(payload.delete({ collection: 'documents', id: documentID })).rejects.toThrow(
      /Can't delete: used in Blog "Localized story".*Remove it there first\./,
    )
    const batch = await payload.delete({
      collection: 'documents',
      where: { id: { equals: documentID } },
    })
    expect(batch.docs).toHaveLength(0)
    expect(batch.errors).toHaveLength(1)
    const originalError = payload.logger.error.bind(payload.logger)
    const expectedError = vi.spyOn(payload.logger, 'error').mockImplementation((...args) => {
      const entry = args[0] as { err?: { message?: string } } | undefined
      if (!entry?.err?.message?.startsWith("Can't delete: used in Blog")) {
        originalError(...args)
      }
    })
    try {
      const response = await handleEndpoints({
        config: payload.config,
        payloadInstanceCacheKey: cacheKey,
        request: new Request(`http://localhost/api/documents/${documentID}`, {
          method: 'DELETE',
          headers: { 'x-test-user': 'fixture' },
        }),
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        errors: [{ message: expect.stringContaining("Can't delete: used in Blog") }],
      })
      expect(expectedError).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            message: expect.stringContaining("Can't delete: used in Blog"),
          }),
        }),
      )
    } finally {
      expectedError.mockRestore()
    }

    await payload.update({
      collection: 'blogs',
      id: blog.id,
      locale: 'zh' as never,
      data: { heroImage: null } as never,
    })
  })
  it('exposes links and history counts only to authenticated callers, with no caching', async () => {
    const endpoint =
      Documents.endpoints && Documents.endpoints.find(({ path }) => path === '/:id/references')
    if (!endpoint) throw new Error('Reference endpoint missing')
    const req = await createLocalReq({}, payload)
    req.routeParams = { id: documentID }
    expect((await endpoint!.handler(req)).status).toBe(401)
    req.user = { id: 'test-user', collection: 'users' } as never
    const response = await endpoint!.handler(req)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    const body = await response.json()
    expect(body.current).toEqual([])
    expect(body.historicalCount).toBeGreaterThan(0)
  })
  it('blocks references in both Header and Settings globals, then permits historical-only deletion', async () => {
    await payload.updateGlobal({
      slug: 'header',
      data: { navItems: [{ image: documentID }] } as never,
    })
    await payload.updateGlobal({ slug: 'settings', data: { image: documentID } as never })
    await expect(payload.delete({ collection: 'documents', id: documentID })).rejects.toThrow(
      /Header.*Settings/,
    )
    await payload.updateGlobal({ slug: 'header', data: { navItems: [] } })
    await payload.updateGlobal({ slug: 'settings', data: { image: null } as never })
    await expect(
      payload.delete({ collection: 'documents', id: documentID }),
    ).resolves.toHaveProperty('id', documentID)
  })
  it('ignores a real operational edit lock and permits deletion when no content references remain', async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: 'lock-owner@example.invalid', password: 'isolated-test-password-123' },
    })
    const doc = await payload.create({
      collection: 'documents',
      data: { title: 'Independent certificate' },
    })
    await payload.create({
      collection: 'payload-locked-documents',
      data: {
        document: { relationTo: 'documents', value: doc.id },
        user: { relationTo: 'users', value: user.id },
      },
    })
    expect(await findDocumentReferences(payload, [doc.id])).toEqual([])
    await expect(payload.delete({ collection: 'documents', id: doc.id })).resolves.toHaveProperty(
      'id',
      doc.id,
    )
  })
  it('ignores native recent-document preferences while preserving content deletion protection', async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: 'recent-owner@example.invalid', password: 'isolated-test-password-123' },
    })
    const doc = await payload.create({
      collection: 'documents',
      data: { title: 'Independent tea certificate' },
    })
    await payload.create({
      collection: 'payload-preferences',
      user,
      data: {
        user: { relationTo: 'users', value: user.id },
        key: 'recent-documents',
        value: { items: [{ id: doc.id, collectionSlug: 'documents' }] },
      },
    })
    expect(await findDocumentReferences(payload, [doc.id])).toEqual([])
    const blog = await payload.create({
      collection: 'blogs',
      data: { title: 'A real tea story', heroImage: doc.id } as never,
    })
    await expect(payload.delete({ collection: 'documents', id: doc.id })).rejects.toThrow(
      /A real tea story/,
    )
    await payload.update({ collection: 'blogs', id: blog.id, data: { heroImage: null } as never })
    await expect(payload.delete({ collection: 'documents', id: doc.id })).resolves.toHaveProperty(
      'id',
      doc.id,
    )
  })

  it.each([false, true])(
    'protects stored and latest collection drafts (autosave=%s), then ignores superseded history',
    async (autosave) => {
      const asset = await payload.create({
        collection: 'documents',
        data: { title: 'Draft tea resource' },
      })
      const owner = await payload.create({
        collection: 'blogs',
        data: { title: 'Draft tea story', _status: 'published' } as never,
      })
      const update = (heroImage: string | null, draft: boolean) =>
        payload.update({
          collection: 'blogs',
          id: owner.id,
          draft,
          autosave: draft && autosave,
          data: { heroImage, _status: draft ? 'draft' : 'published' } as never,
        })
      const current = async () =>
        (await findDocumentReferences(payload, [asset.id])).filter((ref) => ref.kind === 'current')
      await update(String(asset.id), true)
      expect(await current()).toEqual([
        expect.objectContaining({ ownerSlug: 'blogs', path: 'heroImage.en' }),
      ])
      await expect(payload.delete({ collection: 'documents', id: asset.id })).rejects.toThrow(
        /Remove it there first/,
      )
      const batch = await payload.delete({
        collection: 'documents',
        where: { id: { equals: asset.id } },
      })
      expect(batch.docs).toHaveLength(0)
      expect(batch.errors).toHaveLength(1)
      const response = await handleEndpoints({
        config: payload.config,
        payloadInstanceCacheKey: cacheKey,
        request: new Request(`http://localhost/api/documents/${asset.id}`, {
          method: 'DELETE',
          headers: { 'x-test-user': 'fixture' },
        }),
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        errors: [{ message: expect.stringContaining('Remove it there first.') }],
      })
      await update(String(asset.id), false)
      // Both stored and draft copies share one owner/path in the current union.
      await update(String(asset.id), true)
      expect(await current()).toHaveLength(1)
      await update(null, true)
      expect(await current()).toHaveLength(1)
      await expect(payload.delete({ collection: 'documents', id: asset.id })).rejects.toThrow(
        /Remove it there first/,
      )
      await update(null, false)
      await update(null, true)
      expect(await current()).toEqual([])
      expect(
        (await findDocumentReferences(payload, [asset.id])).some((ref) => ref.kind === 'version'),
      ).toBe(true)
      await expect(
        payload.delete({ collection: 'documents', id: asset.id }),
      ).resolves.toHaveProperty('id', asset.id)
    },
  )
  it.each([false, true])(
    'protects stored and latest Global drafts (autosave=%s), then ignores superseded history',
    async (autosave) => {
      const asset = await payload.create({
        collection: 'documents',
        data: { title: 'Global draft tea resource' },
      })
      await payload.updateGlobal({
        slug: 'header',
        data: { navItems: [], _status: 'published' } as never,
      })
      const update = async (image: string | null, draft: boolean) => {
        const response = await handleEndpoints({
          config: payload.config,
          payloadInstanceCacheKey: cacheKey,
          request: new Request(
            `http://localhost/api/globals/header?draft=${draft}&autosave=${draft && autosave}`,
            {
              method: 'POST',
              headers: { 'x-test-user': 'fixture', 'Content-Type': 'application/json' },
              body: JSON.stringify({
                navItems: image ? [{ image }] : [],
                _status: draft ? 'draft' : 'published',
              }),
            },
          ),
        })
        expect(response.status).toBe(200)
      }
      const current = async () =>
        (await findDocumentReferences(payload, [asset.id])).filter((ref) => ref.kind === 'current')
      await update(String(asset.id), true)
      expect(await current()).toEqual([
        expect.objectContaining({
          ownerType: 'global',
          ownerSlug: 'header',
          path: 'navItems[0].image',
        }),
      ])
      await expect(payload.delete({ collection: 'documents', id: asset.id })).rejects.toThrow(
        /Remove it there first/,
      )
      const batch = await payload.delete({
        collection: 'documents',
        where: { id: { equals: asset.id } },
      })
      expect(batch.docs).toHaveLength(0)
      expect(batch.errors).toHaveLength(1)
      const response = await handleEndpoints({
        config: payload.config,
        payloadInstanceCacheKey: cacheKey,
        request: new Request(`http://localhost/api/documents/${asset.id}`, {
          method: 'DELETE',
          headers: { 'x-test-user': 'fixture' },
        }),
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        errors: [{ message: expect.stringContaining('Header') }],
      })
      await update(String(asset.id), false)
      await update(String(asset.id), true)
      expect(await current()).toHaveLength(1)
      await update(null, true)
      expect(await current()).toHaveLength(1)
      await expect(payload.delete({ collection: 'documents', id: asset.id })).rejects.toThrow(
        /Remove it there first/,
      )
      await update(null, false)
      await update(null, true)
      expect(await current()).toEqual([])
      expect(
        (await findDocumentReferences(payload, [asset.id])).some((ref) => ref.kind === 'version'),
      ).toBe(true)
      await expect(
        payload.delete({ collection: 'documents', id: asset.id }),
      ).resolves.toHaveProperty('id', asset.id)
    },
  )
})
