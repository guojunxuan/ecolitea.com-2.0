// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { consentCopy } from '@/consent/copy'
import { translationPlugin } from '@/plugins/translation'
import {
  dictionaryVersion,
  frontendDictionary,
  getFrontendDictionarySource,
  validateDictionaryFields,
} from '@/plugins/translation/dictionary'
import { mergeTranslation } from '@/plugins/translation/read'
import { getTranslationRuntime } from '@/plugins/translation/hooks'
import { TRANSLATION_QUEUE } from '@/plugins/translation/task'
import { stubTranslationProvider } from '@/plugins/translation/provider/stub'
import { serverEnv } from '@/utilities/env'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => {
    const config = (await import('@/i18n/config')) as unknown as {
      publicLocales?: unknown[]
      targetLocales?: unknown[]
    }
    return { publicLocales: [], targetLocales: config.targetLocales, regions: [] }
  },
}))
vi.mock('@/i18n/config', () => ({
  sourceLocale: 'en',
  locales: [
    { code: 'en', label: 'English', status: 'source' },
    { code: 'de', label: 'Deutsch', status: 'live' },
    { code: 'fr', label: 'Français', status: 'translating' },
  ],
  targetLocales: [
    { code: 'de', label: 'Deutsch', status: 'live' },
    { code: 'fr', label: 'Français', status: 'translating' },
  ],
}))

describe('frontend dictionary source', () => {
  it('contains the consent source copy and Quote templates, notices and validation messages', () => {
    expect(frontendDictionary.consent).toEqual(consentCopy)
    expect(frontendDictionary.quote.successTitle).toBe('Thank you, {name}!')
    expect(frontendDictionary.quote.successMessage).toContain('{product}')
    expect(frontendDictionary.quote.errors.nameRequired).toBe('Name is required.')
    expect(frontendDictionary.quote.errors.nameTooLong).toBe(
      'Name must be 100 characters or fewer.',
    )
    expect(frontendDictionary.quote.errors.productNotFound).toBe('Product not found.')
  })

  it('uses a deterministic source content hash and changes it when source copy changes', () => {
    expect(dictionaryVersion()).toMatch(/^[a-f0-9]{64}$/)
    expect(dictionaryVersion()).toBe(dictionaryVersion())
    expect(dictionaryVersion({ copy: 'Tea' })).not.toBe(dictionaryVersion({ copy: 'Coffee' }))
    expect(getFrontendDictionarySource().doc.updatedAt).toBe(dictionaryVersion())
  })

  it.each([
    ['quote.successTitle', 'Danke!'],
    ['quote.successTitle', 'Danke, {person}!'],
    ['quote.successTitle', 'Danke, {name} {name}!'],
    ['quote.successMessage', 'Received.'],
    ['quote.title', 'Anfrage {extra}'],
  ])('rejects broken placeholder sets for %s', (path, translated) => {
    expect(() => validateDictionaryFields({ [path]: translated })).toThrow('placeholder')
  })

  it('allows translated templates retaining all original named placeholders', () => {
    expect(() =>
      validateDictionaryFields({
        'quote.successTitle': 'Danke, {name}!',
        'quote.successMessage': 'Ihre Anfrage für {product} ist eingegangen.',
      }),
    ).not.toThrow()
  })
})

describe('dictionary Jobs and last-ready reads (isolated MongoDB)', () => {
  const name = `ecolitea2-test-phase4-dictionary-${randomUUID().slice(0, 8)}`
  const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test-phase4')
  let payload: Payload
  const priorEnv = { key: serverEnv.GOOGLE_TRANSLATE_API_KEY, worker: serverEnv.JOBS_AUTORUN }
  const priorInit = vi.fn(async (_payload: Payload) => undefined)
  const translate = vi.fn(stubTranslationProvider.translate)
  const invalidate = vi.fn(async () => undefined)
  const config = buildConfig({
    secret: 'phase2-dictionary-test-secret-at-least-32-characters',
    typescript: { autoGenerate: false },
    db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
    collections: [],
    plugins: [
      translationPlugin({
        enabled: true,
        targets: ['de'],
        provider: { translate },
        reserve: async () => true,
        invalidate,
        retryDelay: 1,
      }),
    ],
    jobs: { deleteJobOnComplete: false },
    onInit: priorInit,
  })
  const rows = () =>
    payload.find({
      collection: 'translations',
      where: { sourceCollection: { equals: 'dictionary' } },
    })
  const jobs = () =>
    payload.find({
      collection: 'payload-jobs',
      where: { queue: { equals: TRANSLATION_QUEUE } },
      limit: 100,
    })
  const startup = () => payload.config.onInit!(payload)

  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase2 dictionary target=${url}; storage=disabled; provider=stub; HTTP=none`)
    serverEnv.GOOGLE_TRANSLATE_API_KEY = 'phase2-placeholder-never-sent'
    serverEnv.JOBS_AUTORUN = false
    payload = await getPayload({ key: name, config })
  }, 20000)
  afterAll(async () => {
    if (priorEnv.key === undefined) Reflect.deleteProperty(serverEnv, 'GOOGLE_TRANSLATE_API_KEY')
    else serverEnv.GOOGLE_TRANSLATE_API_KEY = priorEnv.key
    serverEnv.JOBS_AUTORUN = priorEnv.worker
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
    await payload.delete({ collection: 'translations', where: {} })
    vi.clearAllMocks()
    translate.mockImplementation(stubTranslationProvider.translate)
    invalidate.mockResolvedValue(undefined)
    serverEnv.JOBS_AUTORUN = false
    serverEnv.GOOGLE_TRANSLATE_API_KEY = 'phase2-placeholder-never-sent'
  })

  it('chains prior onInit and requires both the designated worker and credentials', async () => {
    await startup()
    expect(priorInit).toHaveBeenCalledWith(payload)
    expect((await jobs()).totalDocs).toBe(0)
    serverEnv.JOBS_AUTORUN = true
    Reflect.deleteProperty(serverEnv, 'GOOGLE_TRANSLATE_API_KEY')
    await startup()
    expect((await jobs()).totalDocs).toBe(0)
  })

  it('queues a changed hash once and keeps unchanged pending requests intact', async () => {
    serverEnv.JOBS_AUTORUN = true
    await startup()
    const pending = (await rows()).docs[0]
    expect(pending).toMatchObject({
      sourceId: 'frontend',
      requestedSourceVersion: dictionaryVersion(),
      status: 'pending',
    })
    await startup()
    expect((await jobs()).totalDocs).toBe(1)
    await payload.update({
      collection: 'translations',
      id: pending.id,
      data: { requestedSourceVersion: 'z'.repeat(64) },
    })
    await startup()
    expect((await jobs()).totalDocs).toBe(1)
    expect((await rows()).docs[0].requestedSourceVersion).toBe(dictionaryVersion())
  })

  it.each(['waiting_quota', 'failed'] as const)(
    'does not requeue unchanged %s requests at startup',
    async (status) => {
      serverEnv.JOBS_AUTORUN = true
      await payload.create({
        collection: 'translations',
        data: {
          sourceCollection: 'dictionary',
          sourceId: 'frontend',
          locale: 'de',
          status,
          requestedSourceVersion: dictionaryVersion(),
        },
      })
      await startup()
      expect((await jobs()).totalDocs).toBe(0)
    },
  )

  it('translates the dictionary through the real task and never creates a search URL', async () => {
    serverEnv.JOBS_AUTORUN = true
    translate.mockImplementation(async ({ texts }) => texts.map((text) => `DE ${text}`))
    await startup()
    await payload.jobs.run({ queue: TRANSLATION_QUEUE, limit: 1, silent: true })
    expect((await rows()).docs[0]).toMatchObject({
      status: 'ready',
      lastReadySourceVersion: dictionaryVersion(),
      fields: {
        'consent.title': 'DE Your cookie choices',
        'quote.successTitle': 'DE Thank you, {name}!',
      },
    })
    expect((await payload.count({ collection: 'translation-search' })).totalDocs).toBe(0)
    expect(invalidate).toHaveBeenCalled()
    const merged = await mergeTranslation(frontendDictionary, {
      sourceCollection: 'dictionary',
      sourceId: 'frontend',
      locale: 'de',
      payload,
    })
    expect(merged?.consent.title).toBe('DE Your cookie choices')
  })

  it('discards an obsolete dictionary hash before enqueueing', async () => {
    const req = await createLocalReq({}, payload)
    await getTranslationRuntime(req)!.queue(req, {
      sourceCollection: 'dictionary',
      sourceId: 'frontend',
      locale: 'de',
      sourceVersion: 'obsolete',
    })
    expect((await jobs()).totalDocs).toBe(0)
    expect((await rows()).totalDocs).toBe(0)
  })

  it('marks exhausted notification retries failed while keeping a readable last-ready checkpoint', async () => {
    serverEnv.JOBS_AUTORUN = true
    invalidate.mockRejectedValue(new Error('Notification endpoint unavailable'))
    await startup()
    const job = (await jobs()).docs[0]
    for (let attempt = 0; attempt < 3; attempt++) {
      await payload.jobs.runByID({ id: job.id, silent: true })
      await new Promise((resolve) => setTimeout(resolve, 8))
    }
    expect((await rows()).docs[0]).toMatchObject({
      status: 'failed',
      error: 'Notification endpoint unavailable',
      lastReadySourceVersion: dictionaryVersion(),
      fields: { 'consent.title': 'Your cookie choices' },
    })
    expect(translate).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledTimes(3)
    expect(
      (
        await mergeTranslation(frontendDictionary, {
          sourceCollection: 'dictionary',
          sourceId: 'frontend',
          locale: 'de',
          payload,
        })
      )?.consent.title,
    ).toBe('Your cookie choices')
  })

  it('fails malformed translated templates rather than storing broken ready fields', async () => {
    serverEnv.JOBS_AUTORUN = true
    translate.mockImplementation(async ({ texts }) =>
      texts.map((text) => text.replace('{name}', 'someone')),
    )
    await startup()
    const job = (await jobs()).docs[0]
    for (let attempt = 0; attempt < 3; attempt++) {
      await payload.jobs.runByID({ id: job.id, silent: true })
      await new Promise((resolve) => setTimeout(resolve, 8))
    }
    expect((await rows()).docs[0]).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('placeholder'),
    })
    expect((await rows()).docs[0].lastReadySourceVersion).toBeUndefined()
    expect((await payload.count({ collection: 'translation-search' })).totalDocs).toBe(0)
  })

  it('passes English through by reference without touching Payload', async () => {
    const find = vi.spyOn(payload, 'find')
    const doc = { title: 'English' }
    expect(
      await mergeTranslation(doc, {
        sourceCollection: 'products',
        sourceId: 'product',
        locale: 'en',
        payload,
      }),
    ).toBe(doc)
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })

  it('rejects a retained dictionary whose placeholders no longer match the current source', async () => {
    await payload.create({
      collection: 'translations',
      data: {
        sourceCollection: 'dictionary',
        sourceId: 'frontend',
        locale: 'de',
        status: 'failed',
        requestedSourceVersion: dictionaryVersion(),
        lastReadySourceVersion: 'older-dictionary',
        fields: { 'quote.successTitle': 'Danke, {person}!' },
      },
    })
    expect(
      await mergeTranslation(frontendDictionary, {
        sourceCollection: 'dictionary',
        sourceId: 'frontend',
        locale: 'de',
        payload,
      }),
    ).toBeNull()
    const retained = (await rows()).docs[0]
    await payload.update({
      collection: 'translations',
      id: retained.id,
      data: { fields: { 'quote.successTitle': 'Danke, {name}!' } },
    })
    expect(
      (
        await mergeTranslation(frontendDictionary, {
          sourceCollection: 'dictionary',
          sourceId: 'frontend',
          locale: 'de',
          payload,
        })
      )?.quote.successTitle,
    ).toBe('Danke, {name}!')
  })

  it.each(['pending', 'waiting_quota', 'failed', 'ready'] as const)(
    'uses retained last-ready fields while the latest request is %s',
    async (status) => {
      await payload.create({
        collection: 'translations',
        data: {
          sourceCollection: 'products',
          sourceId: 'product',
          locale: 'de',
          status,
          requestedSourceVersion: 'new',
          lastReadySourceVersion: 'old',
          fields: { title: 'Tee', slug: 'unsafe' },
        },
      })
      expect(
        await mergeTranslation(
          { title: 'Tea', slug: 'tea' },
          { sourceCollection: 'products', sourceId: 'product', locale: 'de', payload },
        ),
      ).toEqual({ title: 'Tee', slug: 'tea' })
    },
  )

  it('returns null for unknown locales, unknown owners, and never-ready translations', async () => {
    const doc = { title: 'Tea' }
    const identity = { sourceCollection: 'products', sourceId: 'product', payload }
    expect(await mergeTranslation(doc, { ...identity, locale: 'xx' })).toBeNull()
    expect(await mergeTranslation(doc, { ...identity, locale: 'fr' })).toBeNull()
    expect(
      await mergeTranslation(doc, { ...identity, sourceCollection: 'unknown', locale: 'de' }),
    ).toBeNull()
    await payload.create({
      collection: 'translations',
      data: {
        sourceCollection: 'products',
        sourceId: 'product',
        locale: 'de',
        status: 'pending',
        fields: { title: 'unready' },
      },
    })
    expect(await mergeTranslation(doc, { ...identity, locale: 'de' })).toBeNull()
  })
})
