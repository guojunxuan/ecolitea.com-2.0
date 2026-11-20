// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, createPayloadRequest, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { translationPlugin } from '@/plugins/translation'
import { getTranslationRuntime } from '@/plugins/translation/hooks'
import { TRANSLATION_QUEUE } from '@/plugins/translation/task'
import { stubTranslationProvider } from '@/plugins/translation/provider/stub'
import type { LocaleConfig } from '@/i18n/config'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const locales: readonly LocaleConfig[] = [
  { code: 'en', label: 'English', status: 'source' },
  { code: 'de', label: 'Deutsch', status: 'translating' },
]

describe('translation backfill (isolated MongoDB)', () => {
  const name = `ecolitea2-test-phase4-backfill-${randomUUID().slice(0, 8)}`
  const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test-phase4')
  const translate = vi.fn(stubTranslationProvider.translate)
  let payload: Payload
  let now = new Date('2026-11-15T00:00:00Z')
  const config = buildConfig({
    secret: 'phase3-backfill-test-secret-at-least-32-characters',
    typescript: { autoGenerate: false },
    db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
    collections: [
      {
        slug: 'pages',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
        ],
        versions: { drafts: true },
      },
      {
        slug: 'blogs',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
          { name: 'publishedAt', type: 'date' },
        ],
        versions: { drafts: true },
      },
      {
        slug: 'media',
        fields: [
          { name: 'alt', type: 'text' },
          { name: 'caption', type: 'json' },
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
        reserve: async () => true,
        now: () => now,
        invalidate: async () => undefined,
      }),
    ],
    jobs: { deleteJobOnComplete: false },
  })

  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase3 backfill target=${url}; storage=disabled; provider=stub; HTTP=stub`)
    payload = await getPayload({ config, key: name })
  }, 20000)
  afterAll(async () => {
    if (!payload) return
    console.info(`Phase3 backfill cleanup target=${url}; storage=disabled`)
    try {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
    } finally {
      await payload.destroy()
    }
  })
  beforeEach(async () => {
    await payload.delete({ collection: 'payload-jobs', where: {} })
    await payload.delete({ collection: 'translations', where: {} })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { tagline: 'Site words', privacyPolicyPage: null },
      context: { translationWrite: true },
    })
    for (const collection of ['pages', 'blogs', 'media'] as const)
      await payload.delete({ collection, where: {}, context: { translationWrite: true } })
    translate.mockClear()
    now = new Date('2026-11-15T00:00:00Z')
  })

  it('executes existing updates, then publications, then first backfill even when backfill was queued first', async () => {
    const create = (title: string) =>
      payload.create({
        collection: 'pages',
        data: { title, slug: title, _status: 'published' } as never,
        context: { translationWrite: true },
      })
    const backfill = await create('Backfill')
    const fresh = await create('New')
    const update = await create('Updated')
    const req = await createPayloadRequest({ payload })
    const runtime = getTranslationRuntime(req)!
    await payload.create({
      collection: 'translations',
      data: {
        sourceCollection: 'pages',
        sourceId: update.id,
        locale: 'de',
        status: 'ready',
        lastReadySourceVersion: '2020-01-01T00:00:00.000Z',
        fields: { title: 'Old' },
      },
    })
    await runtime.queue(
      req,
      {
        sourceCollection: 'pages',
        sourceId: backfill.id,
        locale: 'de',
        sourceVersion: backfill.updatedAt,
      },
      { backfill: true },
    )
    await runtime.queue(req, {
      sourceCollection: 'pages',
      sourceId: fresh.id,
      locale: 'de',
      sourceVersion: fresh.updatedAt,
    })
    await runtime.queue(req, {
      sourceCollection: 'pages',
      sourceId: update.id,
      locale: 'de',
      sourceVersion: update.updatedAt,
    })
    const jobs = await payload.find({ collection: 'payload-jobs', sort: 'createdAt' })
    expect(
      jobs.docs.map(({ meta }) => (meta as { translationPriority: number }).translationPriority),
    ).toEqual([2, 1, 0])
    for (let i = 0; i < 3; i++)
      await payload.jobs.run({ queue: TRANSLATION_QUEUE, limit: 1, silent: true })
    expect(translate.mock.calls.map(([arg]) => arg.texts[0])).toEqual([
      'Updated',
      'New',
      'Backfill',
    ])
  })

  it('keeps pending publications above backfill and runs legacy jobs without metadata', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { title: 'Publication', slug: 'publication', _status: 'published' } as never,
      context: { translationWrite: true },
    })
    const legacy = await payload.create({
      collection: 'pages',
      data: { title: 'Legacy', slug: 'legacy', _status: 'published' } as never,
      context: { translationWrite: true },
    })
    const req = await createPayloadRequest({ payload })
    const runtime = getTranslationRuntime(req)!
    const input = {
      sourceCollection: 'pages',
      sourceId: page.id,
      locale: 'de',
      sourceVersion: page.updatedAt,
    }
    await runtime.queue(req, input)
    await runtime.queue(req, input, { backfill: true })
    const job = (await payload.find({ collection: 'payload-jobs' })).docs[0]
    expect(job.meta).toMatchObject({ translationPriority: 1 })
    await payload.jobs.queue({
      task: 'translateDocument',
      queue: TRANSLATION_QUEUE,
      input: { ...input, sourceId: legacy.id, sourceVersion: legacy.updatedAt },
    })
    await payload.jobs.run({ allQueues: true, limit: 1, silent: true })
    await payload.jobs.run({ allQueues: true, limit: 1, silent: true })
    expect(translate.mock.calls.map(([arg]) => arg.texts[0])).toEqual(['Legacy', 'Publication'])
  })

  it('dry-run counts public sources, Globals, Media and dictionary without writing translation rows or jobs', async () => {
    const { runTranslationBackfill } = await import('../../scripts/translation-backfill')
    const legal = await payload.create({
      collection: 'pages',
      data: { title: 'Legal', slug: 'legal', _status: 'published' } as never,
      context: { translationWrite: true },
    })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { privacyPolicyPage: legal.id },
      context: { translationWrite: true },
    })
    await payload.create({
      collection: 'pages',
      data: { title: 'Page', slug: 'page', _status: 'published' } as never,
      context: { translationWrite: true },
    })
    await payload.create({
      collection: 'pages',
      data: { title: 'Private', _status: 'draft' } as never,
      context: { translationWrite: true },
    })
    for (const [title, publishedAt] of [
      ['Visible', '2020-01-01T00:00:00Z'],
      ['Future', '2099-01-01T00:00:00Z'],
    ] as const)
      await payload.create({
        collection: 'blogs',
        data: { title, publishedAt, _status: 'published' } as never,
        context: { translationWrite: true },
      })
    await payload.create({
      collection: 'media',
      data: { alt: 'Alt' },
      context: { translationWrite: true },
    })
    const report = await runTranslationBackfill({ payload, locale: 'de', dryRun: true, locales })
    expect(report).toMatchObject({
      mode: 'dry-run',
      total: 5,
      queued: 0,
      counts: { pages: 1, blogs: 1, media: 1, 'global:site-settings': 1, dictionary: 1 },
    })
    const { getFrontendDictionarySource } = await import('@/plugins/translation/dictionary')
    const { extract } = await import('@/plugins/translation/extract')
    const dictionary = getFrontendDictionarySource()
    const characters = [
      ...new Set(extract(dictionary.doc, dictionary.rule).map(({ source }) => source)),
    ].reduce((count, text) => count + text.length, 0)
    expect(report.estimatedCharacters).toBe(characters + 'PageVisibleAltSite words'.length)
    expect((await payload.count({ collection: 'translations' })).totalDocs).toBe(0)
    expect((await payload.count({ collection: 'payload-jobs' })).totalDocs).toBe(0)
    expect(translate).not.toHaveBeenCalled()
  })

  it('estimates Unicode code points and deduplicates separately for plain text and rich-text HTML', async () => {
    const { runTranslationBackfill } = await import('../../scripts/translation-backfill')
    const baseline = await runTranslationBackfill({ payload, locale: 'de', dryRun: true, locales })
    const alt = '<x0>A😀</x0>'
    await payload.create({
      collection: 'media',
      data: {
        alt,
        caption: {
          root: {
            type: 'root',
            children: [
              { type: 'paragraph', children: [{ type: 'text', text: 'A😀' }] },
              { type: 'paragraph', children: [{ type: 'text', text: 'A😀' }] },
            ],
          },
        },
      } as never,
      context: { translationWrite: true },
    })
    const report = await runTranslationBackfill({ payload, locale: 'de', dryRun: true, locales })
    expect(report.estimatedCharacters - baseline.estimatedCharacters).toBe(
      Array.from(alt).length * 2,
    )
  })

  it('queues the inventory as backfill without modifying sources and preserves the tier on quota recovery', async () => {
    const { runTranslationBackfill } = await import('../../scripts/translation-backfill')
    const page = await payload.create({
      collection: 'pages',
      data: { title: 'Keep source', slug: 'keep-source', _status: 'published' } as never,
      context: { translationWrite: true },
    })
    const report = await runTranslationBackfill({ payload, locale: 'de', locales })
    expect(report).toMatchObject({ mode: 'execute', total: 3, queued: 3 })
    const jobs = await payload.find({ collection: 'payload-jobs', limit: 100 })
    expect(jobs.docs).toHaveLength(3)
    expect(
      jobs.docs.every(
        ({ meta }) => (meta as { translationPriority: number }).translationPriority === 2,
      ),
    ).toBe(true)
    const rows = await payload.find({ collection: 'translations', limit: 100 })
    expect(rows.docs.every((row) => row.requestPriority === 2)).toBe(true)
    expect((await payload.findByID({ collection: 'pages', id: page.id })).updatedAt).toBe(
      page.updatedAt,
    )
    expect(translate).not.toHaveBeenCalled()
    for (const row of rows.docs)
      await payload.update({
        collection: 'translations',
        id: row.id,
        data: { status: 'waiting_quota', updatedAt: '2020-01-01T00:00:00.000Z' } as never,
      })
    await payload.delete({ collection: 'payload-jobs', where: {} })
    const req = await createPayloadRequest({ payload })
    now = new Date('2100-01-01T00:00:00Z')
    await getTranslationRuntime(req)!.recover(req)
    const recovered = await payload.find({ collection: 'payload-jobs', limit: 100 })
    expect(recovered.docs).toHaveLength(3)
    expect(
      recovered.docs.every(
        ({ meta }) => (meta as { translationPriority: number }).translationPriority === 2,
      ),
    ).toBe(true)
  })

  it('keeps legacy dictionary requests without a saved tier in the backfill tier during quota recovery', async () => {
    const { getFrontendDictionarySource } = await import('@/plugins/translation/dictionary')
    await payload.create({
      collection: 'translations',
      data: {
        sourceCollection: 'dictionary',
        sourceId: 'frontend',
        locale: 'de',
        status: 'waiting_quota',
        requestedSourceVersion: getFrontendDictionarySource().sourceVersion,
      },
    })
    now = new Date('2100-01-01T00:00:00Z')
    const req = await createPayloadRequest({ payload })
    await getTranslationRuntime(req)!.recover(req)
    expect((await payload.find({ collection: 'payload-jobs' })).docs[0].meta).toMatchObject({
      translationPriority: 2,
    })
  })

  it('rejects source, unknown and disabled locales before inventory reads', async () => {
    const { runTranslationBackfill } = await import('../../scripts/translation-backfill')
    for (const locale of ['en', 'unknown'])
      await expect(
        runTranslationBackfill({ payload, locale, dryRun: true, locales }),
      ).rejects.toThrow('translating or live')
  })
})

describe('backfill command safety', () => {
  it('requires explicit locale/confirmation, rejects the developer DB and requires a second flag for non-test databases', async () => {
    const { parseBackfillArguments, inspectBackfillTarget } =
      await import('../../scripts/translation-backfill')
    expect(() => parseBackfillArguments(['--locale', 'de', '--dry-run'])).toThrow('--confirm')
    expect(parseBackfillArguments(['--locale=de', '--dry-run', '--confirm'])).toMatchObject({
      locale: 'de',
      dryRun: true,
    })
    expect(() => inspectBackfillTarget('mongodb://127.0.0.1:27017/ecolitea2')).toThrow('developer')
    expect(() => inspectBackfillTarget('mongodb://server/site')).toThrow('--confirm-non-test')
    expect(() => inspectBackfillTarget('mongodb://server/site', 'wrong')).toThrow(
      '--confirm-non-test=site',
    )
    expect(inspectBackfillTarget('mongodb://user:secret@server/site', 'site').database).toBe(
      'server/site',
    )
    expect(inspectBackfillTarget('mongodb://127.0.0.1:27017/ecolitea2-test-phase4').database).toBe(
      '127.0.0.1:27017/ecolitea2-test-phase4',
    )
  })
})
