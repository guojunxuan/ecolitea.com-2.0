// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { translationPlugin } from '@/plugins/translation'
import { getTranslationRuntime } from '@/plugins/translation/hooks'
import { createTranslationRuntime, TRANSLATION_QUEUE } from '@/plugins/translation/task'
import { stubTranslationProvider } from '@/plugins/translation/provider/stub'
import { serverEnv } from '@/utilities/env'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  captureProductPublicState,
  captureProductWriteIntent,
} from '@/collections/Products/hooks/productPublicTransition'
import { revalidateProduct } from '@/collections/Products/hooks/revalidateProduct'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

describe('translation lifecycle and real Jobs (isolated MongoDB)', () => {
  const name = `ecolitea2-test-phase4-jobs-${randomUUID().slice(0, 8)}`
  const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test-phase4')
  let payload: Payload
  let now = new Date('2026-11-15T00:00:00Z')
  const invalidate = vi.fn(async () => undefined)
  const reserve = vi.fn(async () => true)
  const translate = vi.fn(stubTranslationProvider.translate)
  const contexts: Record<string, unknown>[] = []
  const config = buildConfig({
    secret: 'phase2-jobs-test-secret-at-least-32-characters',
    typescript: { autoGenerate: false },
    db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
    collections: [
      {
        slug: 'pages',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
          { name: 'meta', type: 'group', fields: [{ name: 'title', type: 'text' }] },
        ],
        versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true } },
      },
      {
        slug: 'products',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
          { name: 'categorySlug', type: 'text' },
        ],
        versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true } },
        hooks: {
          beforeOperation: [captureProductWriteIntent],
          beforeChange: [captureProductPublicState],
          afterChange: [revalidateProduct],
        },
      },
      {
        slug: 'media',
        fields: [
          { name: 'alt', type: 'text' },
          { name: 'filename', type: 'text' },
        ],
      },
    ],
    globals: [
      {
        slug: 'site-settings',
        fields: [
          { name: 'tagline', type: 'text' },
          { name: 'privacyPolicyPage', type: 'relationship', relationTo: 'pages' },
        ],
      },
    ],
    plugins: [
      translationPlugin({
        enabled: true,
        targets: ['de'],
        provider: { translate },
        reserve,
        invalidate,
        now: () => now,
        retryDelay: 1,
      }),
    ],
    jobs: { deleteJobOnComplete: false },
  })
  const req = () => createLocalReq({}, payload)
  const runtime = async () => getTranslationRuntime(await req())!
  // These deliberately minimal fixture schemas do not replace the app's generated registry.
  const create = (title: string, status: 'draft' | 'published' = 'published') =>
    payload.create({
      collection: 'pages',
      data: { title, slug: title.toLowerCase().replaceAll(' ', '-'), _status: status } as never,
    })
  const rows = (sourceId: string) =>
    payload.find({
      collection: 'translations',
      where: { sourceId: { equals: sourceId } },
      depth: 0,
    })
  const searchRows = (sourceId: string) =>
    payload.find({
      collection: 'translation-search',
      where: { sourceId: { equals: sourceId } },
      depth: 0,
    })
  const jobs = () =>
    payload.find({
      collection: 'payload-jobs',
      where: { queue: { equals: TRANSLATION_QUEUE } },
      limit: 100,
    })
  const run = () => payload.jobs.run({ queue: TRANSLATION_QUEUE, limit: 1, silent: true })
  const runAll = async () => {
    for (let i = 0; i < 30; i++) {
      const result = await run()
      if (result.noJobsRemaining) break
    }
  }
  const changed = async (id: string, title: string) => {
    await new Promise((resolve) => setTimeout(resolve, 5))
    return payload.update({ collection: 'pages', id, data: { title, _status: 'published' } })
  }

  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase2 jobs target=${url}; storage=disabled; provider=stub; HTTP=stub`)
    payload = await getPayload({ config, key: name })
    const collection = payload.collections.translations.config
    collection.hooks.afterChange.push(({ req }) => {
      contexts.push({ ...req.context })
    })
  }, 20000)
  afterAll(async () => {
    if (payload) {
      console.info(`Phase2 cleanup target=${url}; storage=disabled`)
      try {
        await (payload.db as MongooseAdapter).connection.dropDatabase()
      } finally {
        await payload.destroy()
      }
    }
  })
  beforeEach(async () => {
    await payload.delete({ collection: 'payload-jobs', where: {} })
    vi.clearAllMocks()
    translate.mockImplementation(stubTranslationProvider.translate)
    reserve.mockResolvedValue(true)
    invalidate.mockResolvedValue(undefined)
    now = new Date('2026-11-15T00:00:00Z')
  })

  it('excludes drafts/autosaves and supersedes repeated publishes, recovering write projections', async () => {
    const doc = await create('Publish', 'draft')
    await payload.update({
      collection: 'pages',
      id: doc.id,
      draft: true,
      autosave: true,
      data: { title: 'Autosave' },
    })
    expect((await jobs()).totalDocs).toBe(0)
    await payload.update({
      collection: 'pages',
      id: doc.id,
      select: { title: true },
      data: { _status: 'published' },
    })
    expect((await jobs()).totalDocs).toBe(1)
    await changed(doc.id, 'Again')
    expect((await jobs()).totalDocs).toBe(1)
    expect((await jobs()).docs[0].input).toMatchObject({
      sourceVersion: (await payload.findByID({ collection: 'pages', id: doc.id })).updatedAt,
    })
    await payload.update({
      collection: 'pages',
      id: doc.id,
      draft: true,
      autosave: true,
      data: { title: 'Private draft', _status: 'draft' },
    })
    expect((await jobs()).totalDocs).toBe(1)
    await payload.update({
      collection: 'pages',
      id: doc.id,
      draft: true,
      autosave: true,
      data: { _status: 'published' },
    })
    expect((await jobs()).totalDocs).toBe(1)
  })

  it('uses native scheduled publishing and unpublishing with a newer private draft', async () => {
    const doc = await create('Scheduled', 'draft')
    const job = await payload.jobs.queue({
      task: 'schedulePublish',
      input: { doc: { relationTo: 'pages', value: doc.id }, type: 'publish' },
    })
    await payload.jobs.runByID({ id: job.id, silent: true })
    expect((await jobs()).totalDocs).toBe(1)
    await runAll()
    expect((await rows(doc.id)).docs[0].status).toBe('ready')
    await payload.update({
      collection: 'pages',
      id: doc.id,
      draft: true,
      data: { title: 'Newer private', _status: 'draft' },
    })
    expect((await rows(doc.id)).totalDocs).toBe(1)
    const unpublish = await payload.jobs.queue({
      task: 'schedulePublish',
      input: { doc: { relationTo: 'pages', value: doc.id }, type: 'unpublish' },
    })
    await payload.jobs.runByID({ id: unpublish.id, silent: true })
    expect((await rows(doc.id)).totalDocs).toBe(0)
    expect((await searchRows(doc.id)).totalDocs).toBe(0)
  })

  it('publishes a native scheduled Product through the authenticated cache fallback', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Scheduled Product',
        slug: 'scheduled',
        categorySlug: 'tea',
        _status: 'draft',
      } as never,
      context: { disableRevalidate: true },
    })
    const previousSecret = serverEnv.REVALIDATE_SECRET
    serverEnv.REVALIDATE_SECRET = 'phase2-scheduled-only'
    const http = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', http)
    const missingStore = () => {
      throw new Error('Invariant: static generation store missing')
    }
    vi.mocked(revalidatePath).mockImplementation(missingStore)
    vi.mocked(revalidateTag).mockImplementation(missingStore)
    try {
      const job = await payload.jobs.queue({
        task: 'schedulePublish',
        input: { doc: { relationTo: 'products', value: product.id }, type: 'publish' },
      })
      await payload.jobs.runByID({ id: job.id, silent: true })
      expect(
        (await payload.findByID({ collection: 'payload-jobs', id: job.id })).completedAt,
      ).toBeTruthy()
      expect((await jobs()).totalDocs).toBe(1)
      const batches = http.mock.calls.map(
        ([, init]) => JSON.parse(init!.body as string) as { paths: string[]; tags: string[] },
      )
      expect(batches.some(({ paths }) => paths.includes('/en/products/tea/scheduled'))).toBe(true)
      expect(batches.some(({ tags }) => tags.includes('products-list'))).toBe(true)
      expect(batches.some(({ tags }) => tags.includes('redirects'))).toBe(true)
      expect(
        http.mock.calls.every(
          ([, init]) =>
            (init!.headers as Record<string, string>).Authorization ===
            'Bearer phase2-scheduled-only',
        ),
      ).toBe(true)
    } finally {
      vi.mocked(revalidatePath).mockReset()
      vi.mocked(revalidateTag).mockReset()
      vi.unstubAllGlobals()
      if (previousSecret === undefined) Reflect.deleteProperty(serverEnv, 'REVALIDATE_SECRET')
      else serverEnv.REVALIDATE_SECRET = previousSecret
    }
  })

  it('does not let a delayed older producer supersede the current queued generation', async () => {
    const doc = await create('Older producer')
    const current = await changed(doc.id, 'Current producer')
    await (
      await runtime()
    ).queue(await req(), {
      sourceCollection: 'pages',
      sourceId: doc.id,
      locale: 'de',
      sourceVersion: doc.updatedAt,
    })
    expect((await rows(doc.id)).docs[0].requestedSourceVersion).toBe(current.updatedAt)
    expect((await jobs()).docs[0].input).toMatchObject({ sourceVersion: current.updatedAt })
    await runAll()
    expect((await rows(doc.id)).docs[0].lastReadySourceVersion).toBe(current.updatedAt)
  })

  it('excludes legal pages both at enqueue and when their designation changes during translation', async () => {
    const legal = await create('Legal', 'draft')
    await payload.updateGlobal({ slug: 'site-settings', data: { privacyPolicyPage: legal.id } })
    await payload.update({ collection: 'pages', id: legal.id, data: { _status: 'published' } })
    expect((await rows(legal.id)).totalDocs).toBe(0)
    const doc = await create('Becomes legal')
    translate.mockImplementationOnce(async ({ texts }) => {
      await payload.updateGlobal({ slug: 'site-settings', data: { privacyPolicyPage: doc.id } })
      return texts
    })
    await runAll()
    expect((await rows(doc.id)).docs[0]?.status).not.toBe('ready')
    expect((await searchRows(doc.id)).totalDocs).toBe(0)
  })

  it('writes ready translations and English-slug search rows with scoped context and no source-hook loop', async () => {
    const doc = await create('Success')
    translate.mockImplementation(async ({ texts }) => texts.map((text) => `DE ${text}`))
    await runAll()
    expect((await rows(doc.id)).docs[0]).toMatchObject({
      status: 'ready',
      requestedSourceVersion: doc.updatedAt,
      lastReadySourceVersion: doc.updatedAt,
      fields: { title: 'DE Success' },
    })
    expect((await searchRows(doc.id)).docs[0]).toMatchObject({
      title: 'DE Success',
      path: '/success',
      ready: true,
      sourceVersion: doc.updatedAt,
    })
    expect((await jobs()).totalDocs).toBe(1)
    expect(contexts.some((context) => context.translationWrite === true)).toBe(true)
    expect(invalidate).toHaveBeenCalled()
  })

  it('cleans an existing translation when a projected Global write reclassifies its Page as legal', async () => {
    const doc = await create('New legal policy')
    await runAll()
    expect((await rows(doc.id)).totalDocs).toBe(1)
    await payload.updateGlobal({
      slug: 'site-settings',
      select: { tagline: true, updatedAt: true },
      data: { privacyPolicyPage: doc.id },
    })
    expect((await rows(doc.id)).totalDocs).toBe(0)
    expect((await searchRows(doc.id)).totalDocs).toBe(0)
  })

  it.each(['changed', 'unpublished', 'deleted'] as const)(
    'discards a result if its source is %s during the provider call',
    async (mutation) => {
      const doc = await create(`Race ${mutation}`)
      translate.mockImplementationOnce(async ({ texts }) => {
        if (mutation === 'changed') await changed(doc.id, 'New generation')
        else if (mutation === 'unpublished')
          await payload.update({ collection: 'pages', id: doc.id, data: { _status: 'draft' } })
        else await payload.delete({ collection: 'pages', id: doc.id })
        return texts.map((text) => `stale ${text}`)
      })
      await run()
      expect((await rows(doc.id)).docs[0]?.lastReadySourceVersion).not.toBe(doc.updatedAt)
      expect((await searchRows(doc.id)).totalDocs).toBe(0)
    },
  )

  it('waits for quota and recovers only in a new UTC month, prioritizing existing translations', async () => {
    const old = await create('Existing')
    await runAll()
    await changed(old.id, 'Existing update')
    const fresh = await create('Fresh')
    reserve.mockResolvedValue(false)
    await runAll()
    expect((await rows(old.id)).docs[0].status).toBe('waiting_quota')
    expect((await rows(fresh.id)).docs[0].status).toBe('waiting_quota')
    await payload.delete({ collection: 'payload-jobs', where: {} })
    await (await runtime()).recover(await req())
    expect((await jobs()).totalDocs).toBe(0)
    now = new Date('2026-12-01T00:00:00Z')
    await (await runtime()).recover(await req())
    const queued = await payload.find({
      collection: 'payload-jobs',
      sort: 'createdAt',
      where: { queue: { equals: TRANSLATION_QUEUE } },
    })
    expect(queued.docs.map((job) => (job.input as { sourceId: string }).sourceId)).toEqual([
      old.id,
      fresh.id,
    ])
    reserve.mockResolvedValue(true)
    await runAll()
    expect((await rows(old.id)).docs[0].status).toBe('ready')
  })

  it('retries failures and finally marks failed while retaining the last-ready translation', async () => {
    const doc = await create('Retained')
    await runAll()
    await changed(doc.id, 'Failed generation')
    translate.mockRejectedValue(new Error('Offline provider failed'))
    const job = (await jobs()).docs.find((job) => !job.completedAt)!
    for (let attempt = 1; attempt <= 3; attempt++) {
      await payload.jobs.runByID({ id: job.id, silent: true })
      const state = await payload.findByID({ collection: 'payload-jobs', id: job.id })
      expect(state.totalTried).toBe(attempt)
      expect(Boolean(state.hasError)).toBe(attempt === 3)
      await new Promise((resolve) => setTimeout(resolve, 8))
    }
    expect((await rows(doc.id)).docs[0]).toMatchObject({
      status: 'failed',
      lastReadySourceVersion: doc.updatedAt,
      fields: { title: 'Retained' },
      error: 'Offline provider failed',
    })
  })

  it('retries cache invalidation without translating or reserving quota twice', async () => {
    const doc = await create('Notify retry')
    invalidate.mockRejectedValueOnce(new Error('Endpoint unavailable'))
    await run()
    await new Promise((resolve) => setTimeout(resolve, 8))
    await run()
    expect(translate).toHaveBeenCalledTimes(1)
    expect(reserve).toHaveBeenCalledTimes(1)
    expect((await rows(doc.id)).docs[0].status).toBe('ready')
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('uses the Products owner snapshot before its final consumer clears it', async () => {
    const doc = await payload.create({
      collection: 'products',
      data: {
        title: 'Product',
        slug: 'product',
        categorySlug: 'tea',
        _status: 'published',
      } as never,
      context: { disableRevalidate: true },
    })
    await runAll()
    await payload.update({
      collection: 'products',
      id: doc.id,
      draft: true,
      data: { _status: 'draft', title: 'Private' },
      context: { disableRevalidate: true },
    })
    expect((await rows(doc.id)).totalDocs).toBe(1)
    await payload.update({
      collection: 'products',
      id: doc.id,
      data: { _status: 'draft' },
      context: { disableRevalidate: true },
    })
    expect((await rows(doc.id)).totalDocs).toBe(0)
    expect((await searchRows(doc.id)).totalDocs).toBe(0)
  })

  it.each(['unpublished', 'deleted'] as const)(
    'does not recreate checkpoint search rows when the source is %s during retry',
    async (mutation) => {
      const doc = await create(`Checkpoint ${mutation}`)
      invalidate.mockRejectedValueOnce(new Error('Endpoint unavailable'))
      await run()
      await new Promise((resolve) => setTimeout(resolve, 8))
      const originalFind = payload.find.bind(payload)
      let changed = false
      const find = vi.spyOn(payload, 'find').mockImplementation((async (
        args: Parameters<Payload['find']>[0],
      ) => {
        const result = await originalFind(args)
        if (args.collection === 'translations' && !changed) {
          changed = true
          if (mutation === 'deleted') await payload.delete({ collection: 'pages', id: doc.id })
          else await payload.update({ collection: 'pages', id: doc.id, data: { _status: 'draft' } })
        }
        return result
      }) as Payload['find'])
      try {
        await run()
      } finally {
        find.mockRestore()
      }
      expect(changed).toBe(true)
      expect((await rows(doc.id)).totalDocs).toBe(0)
      expect((await searchRows(doc.id)).totalDocs).toBe(0)
      expect(translate).toHaveBeenCalledOnce()
    },
  )

  it('treats non-drafts Media and Globals as published and never fabricates search URLs', async () => {
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Image alt', filename: 'original.jpg' },
    })
    await payload.updateGlobal({ slug: 'site-settings', data: { tagline: 'Global copy' } })
    await runAll()
    expect((await rows(media.id)).docs[0]).toMatchObject({
      status: 'ready',
      fields: { alt: 'Image alt' },
    })
    expect((await searchRows(media.id)).totalDocs).toBe(0)
    expect((await rows('site-settings')).docs[0].status).toBe('ready')
    expect((await searchRows('site-settings')).totalDocs).toBe(0)
    await payload.update({ collection: 'media', id: media.id, data: { alt: 'Updated alt' } })
    expect((await rows(media.id)).docs[0].status).toBe('pending')
  })

  it('cleans every locale on deletion regardless of latest draft and restores nested context', async () => {
    const doc = await create('Delete')
    await runAll()
    const request = await req()
    const prior = request.context
    await (
      await runtime()
    ).queue(request, {
      sourceCollection: 'pages',
      sourceId: doc.id,
      locale: 'de',
      sourceVersion: doc.updatedAt,
    })
    expect(request.context).toBe(prior)
    await payload.create({
      collection: 'translations',
      data: { sourceCollection: 'pages', sourceId: doc.id, locale: 'fr', status: 'pending' },
    })
    await payload.update({
      collection: 'pages',
      id: doc.id,
      draft: true,
      data: { _status: 'draft' },
    })
    await payload.delete({ collection: 'pages', id: doc.id })
    expect((await rows(doc.id)).totalDocs).toBe(0)
    expect((await searchRows(doc.id)).totalDocs).toBe(0)
  })

  it('deduplicates equal source text while writing every destination path', async () => {
    const doc = await payload.create({
      collection: 'pages',
      data: {
        title: 'Repeated',
        slug: 'repeated',
        meta: { title: 'Repeated' },
        _status: 'published',
      } as never,
    })
    await runAll()
    expect(translate).toHaveBeenCalledOnce()
    expect(translate.mock.calls[0][0].texts).toEqual(['Repeated'])
    expect((await rows(doc.id)).docs[0].fields).toEqual({
      title: 'Repeated',
      'meta.title': 'Repeated',
    })
    await (
      await runtime()
    ).queue(await req(), {
      sourceCollection: 'pages',
      sourceId: doc.id,
      locale: 'de',
      sourceVersion: doc.updatedAt,
    })
    await runAll()
    expect((await rows(doc.id)).docs[0].status).toBe('ready')
    expect(translate).toHaveBeenCalledOnce()
  })

  it('disables queueing without credentials or targets while still removing every stored locale', async () => {
    const doc = await create('Disabled cleanup')
    await runAll()
    await payload.delete({ collection: 'payload-jobs', where: {} })
    const disabled = createTranslationRuntime({ enabled: false, targets: [], invalidate })
    const request = await req()
    await disabled.queue(request, {
      sourceCollection: 'pages',
      sourceId: doc.id,
      locale: 'de',
      sourceVersion: doc.updatedAt,
    })
    expect((await jobs()).totalDocs).toBe(0)
    await disabled.cleanup(request, 'pages', doc.id)
    expect((await rows(doc.id)).totalDocs).toBe(0)
    expect((await searchRows(doc.id)).totalDocs).toBe(0)
  })

  it('starts a single real autoRun cron only with cron:true and processes the translation queue', async () => {
    expect(payload.crons).toHaveLength(0)
    payload.config.jobs.autoRun = [{ cron: '* * * * * *', allQueues: true, limit: 1, silent: true }]
    const doc = await create('Auto worker')
    const running = await getPayload({ config, key: name, cron: true })
    try {
      expect(running.crons).toHaveLength(1)
      await expect
        .poll(async () => (await rows(doc.id)).docs[0]?.status, { timeout: 6000 })
        .toBe('ready')
    } finally {
      running.crons.forEach((cron) => cron.stop())
      // stop() prevents the next tick; wait for the in-flight callback before
      // dropping this suite's database and closing its MongoDB client.
      await expect.poll(() => running.crons.every((cron) => !cron.isBusy())).toBe(true)
    }
  }, 10000)
})
