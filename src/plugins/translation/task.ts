import type { CollectionSlug, GlobalSlug, PayloadRequest, TaskConfig, Where } from 'payload'
import type { Translation, TranslationSearch } from '@/payload-types'
import { sourceLocale, targetLocales } from '@/i18n/config'
import { serverEnv } from '@/utilities/env'
import { getContentPath } from '@/utilities/getContentPath'
import { extract } from './extract'
import { merge } from './merge'
import { createTranslationProvider } from './provider/stub'
import { QuotaExceededError, type TranslationProvider } from './provider/types'
import { createQuota } from './quota'
import { requestRevalidation, type TranslationInvalidation } from './revalidate'
import { getTranslationRule, RULE_VERSION } from './rules'
import { getFrontendDictionarySource, validateDictionaryFields } from './dictionary'

export const TRANSLATION_QUEUE = 'translations'
export type TranslationInput = {
  sourceCollection: string
  sourceId: string
  locale: string
  sourceVersion: string
}
export type SourceDocument = Record<string, unknown> & {
  id?: string | number
  updatedAt?: string
  _status?: string
}
export type TranslationOptions = {
  enabled?: boolean
  targets?: readonly string[]
  provider?: TranslationProvider
  reserve?: (characters: number, req: PayloadRequest) => Promise<boolean>
  invalidate?: (invalidation: TranslationInvalidation) => Promise<void>
  now?: () => Date
  retryDelay?: number
}

const identityWhere = (
  input: Pick<TranslationInput, 'sourceCollection' | 'sourceId'> & { locale?: string },
): Where => ({
  and: [
    { sourceCollection: { equals: input.sourceCollection } },
    { sourceId: { equals: input.sourceId } },
    ...(input.locale ? [{ locale: { equals: input.locale } }] : []),
  ],
})

export const withTranslationContext = async <T>(
  req: PayloadRequest,
  operation: () => Promise<T>,
): Promise<T> => {
  const prior = req.context
  req.context = { ...prior, translationWrite: true }
  try {
    return await operation()
  } finally {
    req.context = prior
  }
}

export async function isLegalPage(req: PayloadRequest, id: string): Promise<boolean> {
  if (!req.payload.config.globals.some(({ slug }) => slug === 'site-settings')) return false
  const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 0, req })
  return [settings.privacyPolicyPage, settings.cookiePolicyPage, settings.termsPage].some(
    (value) => String(value && typeof value === 'object' ? value.id : value) === id,
  )
}

export function createTranslationRuntime(options: TranslationOptions = {}) {
  const targets = options.targets ?? targetLocales.map(({ code }) => code)
  const canQueue =
    (options.enabled ?? Boolean(serverEnv.GOOGLE_TRANSLATE_API_KEY)) && targets.length > 0
  const provider = options.provider ?? createTranslationProvider(serverEnv.GOOGLE_TRANSLATE_API_KEY)
  const invalidate = options.invalidate ?? requestRevalidation
  const now = options.now ?? (() => new Date())
  const retries = 2
  const sourceRule = (sourceCollection: string) =>
    sourceCollection === 'dictionary'
      ? getFrontendDictionarySource().rule
      : getTranslationRule(sourceCollection)

  const findTranslation = async (req: PayloadRequest, input: TranslationInput) =>
    (
      await req.payload.find({
        collection: 'translations',
        where: identityWhere(input),
        limit: 1,
        depth: 0,
        req,
      })
    ).docs[0]

  const writeTranslation = async (
    req: PayloadRequest,
    input: TranslationInput,
    data: Partial<Translation>,
  ) =>
    withTranslationContext(req, async () => {
      const existing = await findTranslation(req, input)
      if (existing) {
        // Hashes have no ordering: only the current source hash may replace a dictionary request.
        if (input.sourceCollection === 'dictionary' && !(await currentSource(req, input)))
          return existing
        if (
          input.sourceCollection !== 'dictionary' &&
          existing.requestedSourceVersion &&
          existing.requestedSourceVersion > input.sourceVersion
        )
          return existing
        return req.payload.update({
          collection: 'translations',
          id: existing.id,
          data,
          overrideAccess: true,
          req,
        })
      }
      try {
        return await req.payload.create({
          collection: 'translations',
          data: {
            sourceCollection: input.sourceCollection,
            sourceId: input.sourceId,
            locale: input.locale,
            ...data,
            status: data.status ?? 'pending',
          },
          overrideAccess: true,
          req,
        })
      } catch (error) {
        // A concurrent source publication can create the unique identity first.
        const winner = await findTranslation(req, input)
        if (!winner) throw error
        // Never let an older producer replace a newer queued source generation.
        if (input.sourceCollection === 'dictionary' && !(await currentSource(req, input)))
          return winner
        if (
          input.sourceCollection !== 'dictionary' &&
          winner.requestedSourceVersion &&
          winner.requestedSourceVersion > input.sourceVersion
        )
          return winner
        return req.payload.update({
          collection: 'translations',
          id: winner.id,
          data,
          overrideAccess: true,
          req,
        })
      }
    })

  const readSource = async (
    req: PayloadRequest,
    input: TranslationInput,
  ): Promise<SourceDocument | null> => {
    if (input.sourceCollection === 'dictionary') {
      return input.sourceId === 'frontend' ? getFrontendDictionarySource().doc : null
    }
    if (!sourceRule(input.sourceCollection)) return null
    if (input.sourceCollection.startsWith('global:')) {
      const slug = input.sourceCollection.slice(7) as GlobalSlug
      if (
        input.sourceId !== slug ||
        !req.payload.config.globals.some((global) => global.slug === slug)
      )
        return null
      return (await req.payload.findGlobal({
        slug,
        depth: 0,
        draft: false,
        req,
      })) as unknown as SourceDocument
    }
    const collection = req.payload.collections[input.sourceCollection as CollectionSlug]?.config
    if (!collection) return null
    const doc = (await req.payload.findByID({
      collection: collection.slug,
      id: input.sourceId,
      depth: 0,
      draft: false,
      disableErrors: true,
      req,
    })) as SourceDocument | null
    if (!doc || (collection.versions?.drafts && doc._status !== 'published')) return null
    if (input.sourceCollection === 'pages' && (await isLegalPage(req, input.sourceId))) return null
    return doc
  }
  const currentSource = async (req: PayloadRequest, input: TranslationInput) => {
    const doc = await readSource(req, input)
    return doc?.updatedAt === input.sourceVersion ? doc : null
  }
  const notify = (input: Pick<TranslationInput, 'sourceCollection' | 'sourceId' | 'locale'>) =>
    invalidate({
      tags: [
        `translation:${input.sourceCollection}:${input.sourceId}:${input.locale}`,
        `translations:${input.locale}`,
        'translation-search',
        'translations-sitemap',
      ],
    })

  const queue = async (req: PayloadRequest, input: TranslationInput): Promise<void> => {
    const prior = req.context
    try {
      if (!canQueue || !targets.includes(input.locale) || req.context.translationWrite) return
      if (!(await currentSource(req, input))) return
      const owner = await writeTranslation(req, input, {
        status: 'pending',
        requestedSourceVersion: input.sourceVersion,
        error: null,
      })
      if (owner.requestedSourceVersion !== input.sourceVersion) return
      await req.payload.jobs.queue({
        task: 'translateDocument',
        queue: TRANSLATION_QUEUE,
        input,
        req,
      })
    } finally {
      req.context = prior
    }
  }

  const cleanup = async (
    req: PayloadRequest,
    sourceCollection: string,
    sourceId: string,
  ): Promise<void> => {
    const where = identityWhere({ sourceCollection, sourceId })
    const locales = new Set<string>(targets)
    // Delete in batches, collecting all stored locales (including removed config locales).
    await withTranslationContext(req, async () => {
      for (const collection of ['translations', 'translation-search'] as const) {
        let page
        do {
          page = await req.payload.find({ collection, where, limit: 100, depth: 0, req })
          for (const doc of page.docs) {
            locales.add(doc.locale)
            await req.payload.delete({ collection, id: doc.id, overrideAccess: true, req })
          }
        } while (page.hasNextPage)
      }
    })
    for (const locale of locales) await notify({ sourceCollection, sourceId, locale })
  }

  const syncSearch = async (
    req: PayloadRequest,
    input: TranslationInput,
    source: SourceDocument,
    fields: Record<string, string>,
  ) => {
    const path =
      typeof source.slug === 'string'
        ? getContentPath(input.sourceCollection as CollectionSlug, source.slug, {
            categorySlug: typeof source.categorySlug === 'string' ? source.categorySlug : null,
          })
        : null
    // Globals, Forms and Media have no public document URL. Their translations are
    // consumed through owners in Phase 3; never fabricate a searchable landing page.
    if (!path) return
    const translated = merge(source, fields, sourceRule(input.sourceCollection)!)
    const title = typeof translated.title === 'string' ? translated.title : ''
    if (!title) return
    const excerpt = [
      translated.excerpt,
      translated.summary,
      (translated.meta as Record<string, unknown> | undefined)?.description,
    ].find((value) => typeof value === 'string') as string | undefined
    const data: Omit<TranslationSearch, 'id' | 'createdAt' | 'updatedAt'> = {
      sourceCollection: input.sourceCollection,
      sourceId: input.sourceId,
      locale: input.locale,
      sourceVersion: input.sourceVersion,
      title,
      excerpt,
      path,
      ready: true,
    }
    await withTranslationContext(req, async () => {
      const existing = (
        await req.payload.find({
          collection: 'translation-search',
          where: identityWhere(input),
          limit: 1,
          depth: 0,
          req,
        })
      ).docs[0]
      if (existing)
        await req.payload.update({
          collection: 'translation-search',
          id: existing.id,
          data,
          overrideAccess: true,
          req,
        })
      else {
        try {
          await req.payload.create({
            collection: 'translation-search',
            data,
            overrideAccess: true,
            req,
          })
        } catch (error) {
          const winner = (
            await req.payload.find({
              collection: 'translation-search',
              where: identityWhere(input),
              limit: 1,
              depth: 0,
              req,
            })
          ).docs[0]
          if (!winner) throw error
          await req.payload.update({
            collection: 'translation-search',
            id: winner.id,
            data,
            overrideAccess: true,
            req,
          })
        }
      }
    })
  }

  const execute: Exclude<
    TaskConfig<{ input: TranslationInput; output: { skipped: boolean } }>['handler'],
    string
  > = async ({ input, req, job }) => {
    if (!canQueue || !targets.includes(input.locale)) return { output: { skipped: true } }
    const source = await currentSource(req, input)
    if (!source) return { output: { skipped: true } }
    try {
      const existing = await findTranslation(req, input)
      // The durable result is the checkpoint. Endpoint/search failures retry this
      // part without spending provider quota or translating the same version again.
      if (
        existing?.lastReadySourceVersion === input.sourceVersion &&
        existing.ruleVersion === RULE_VERSION &&
        existing.fields &&
        typeof existing.fields === 'object' &&
        !Array.isArray(existing.fields)
      ) {
        const current = await currentSource(req, input)
        const owner = await findTranslation(req, input)
        if (!current || owner?.requestedSourceVersion !== input.sourceVersion)
          return { output: { skipped: true } }
        if (existing.status !== 'ready') {
          const saved = await writeTranslation(req, input, { status: 'ready', error: null })
          if (
            saved.requestedSourceVersion !== input.sourceVersion ||
            saved.lastReadySourceVersion !== input.sourceVersion
          )
            return { output: { skipped: true } }
        }
        await syncSearch(req, input, current, existing.fields as Record<string, string>)
        await notify(input)
        return { output: { skipped: false } }
      }
      const entries = extract(source, sourceRule(input.sourceCollection)!)
      const groups = new Map<'text' | 'html', Map<string, string>>()
      for (const entry of entries) {
        const format = entry.kind === 'text' ? 'text' : 'html'
        if (!groups.has(format)) groups.set(format, new Map())
        groups.get(format)!.set(entry.source, '')
      }
      const characters = [...groups.values()].reduce(
        (count, group) =>
          count + [...group.keys()].reduce((sum, source) => sum + Array.from(source).length, 0),
        0,
      )
      const permitted = options.reserve
        ? await options.reserve(characters, req)
        : await createQuota(
            req.payload,
            serverEnv.TRANSLATION_MONTHLY_CHAR_LIMIT,
            now,
            req,
          ).reserve(characters)
      if (!permitted) {
        if (await currentSource(req, input))
          await writeTranslation(req, input, {
            status: 'waiting_quota',
            requestedSourceVersion: input.sourceVersion,
            characters,
          })
        return { output: { skipped: false } }
      }
      for (const [format, group] of groups) {
        const sources = [...group.keys()]
        const translated = await provider.translate({
          texts: sources,
          source: sourceLocale,
          target: input.locale,
          format,
        })
        if (
          translated.length !== sources.length ||
          translated.some((value) => typeof value !== 'string')
        )
          throw new Error('Translation provider returned an invalid result')
        sources.forEach((source, index) => group.set(source, translated[index]))
      }
      // Publication/deletion/legal designation may change while the provider runs.
      // Both the public generation and queued ownership must still match.
      const current = await currentSource(req, input)
      const owner = await findTranslation(req, input)
      if (
        !current ||
        (owner?.requestedSourceVersion && owner.requestedSourceVersion !== input.sourceVersion)
      )
        return { output: { skipped: true } }
      const fields = Object.fromEntries(
        entries.map((entry) => [
          entry.path,
          groups.get(entry.kind === 'text' ? 'text' : 'html')!.get(entry.source)!,
        ]),
      )
      if (input.sourceCollection === 'dictionary') validateDictionaryFields(fields)
      const saved = await writeTranslation(req, input, {
        status: 'ready',
        requestedSourceVersion: input.sourceVersion,
        lastReadySourceVersion: input.sourceVersion,
        fields,
        ruleVersion: RULE_VERSION,
        characters,
        translatedAt: now().toISOString(),
        error: null,
      })
      if (
        saved.requestedSourceVersion !== input.sourceVersion ||
        saved.lastReadySourceVersion !== input.sourceVersion
      )
        return { output: { skipped: true } }
      await syncSearch(req, input, current, fields)
      await notify(input)
      return { output: { skipped: false } }
    } catch (error) {
      const owner = await findTranslation(req, input)
      if (
        (await currentSource(req, input)) &&
        (!owner?.requestedSourceVersion || owner.requestedSourceVersion === input.sourceVersion)
      ) {
        const message = error instanceof Error ? error.message : 'Translation task failed'
        // Only provider work can exhaust quota; a stored checkpoint remains reusable.
        if (
          (owner?.lastReadySourceVersion !== input.sourceVersion ||
            owner.ruleVersion !== RULE_VERSION) &&
          error instanceof QuotaExceededError
        ) {
          await writeTranslation(req, input, {
            status: 'waiting_quota',
            requestedSourceVersion: input.sourceVersion,
            error: message,
          })
          return { output: { skipped: false } }
        }
        // Installed canary passes prior attempts into the handler; two retries
        // means three executions. Terminal notification failures also mark failed,
        // retaining fields/lastReadySourceVersion for reads and checkpoint retries.
        if ((job.totalTried ?? 0) >= retries)
          await writeTranslation(req, input, {
            status: 'failed',
            requestedSourceVersion: input.sourceVersion,
            error: message,
          })
      }
      throw error
    }
  }

  const recover = async (req: PayloadRequest): Promise<void> => {
    if (!canQueue) return
    const boundary = `${now().toISOString().slice(0, 7)}-01T00:00:00.000Z`
    const waiting: Translation[] = []
    let page = 1
    let result
    do {
      result = await req.payload.find({
        collection: 'translations',
        where: {
          and: [{ status: { equals: 'waiting_quota' } }, { updatedAt: { less_than: boundary } }],
        },
        sort: 'createdAt',
        limit: 100,
        page,
        depth: 0,
        req,
      })
      waiting.push(...result.docs)
      page++
    } while (result.hasNextPage)
    // There is no bulk backfill producer in Phase 2. Dictionary startup (Task 8)
    // is the final tier; existing translations precede new publication requests.
    const tier = (row: Translation) =>
      row.lastReadySourceVersion ? 0 : row.sourceCollection === 'dictionary' ? 2 : 1
    waiting.sort((a, b) => tier(a) - tier(b) || a.createdAt.localeCompare(b.createdAt))
    for (const row of waiting) {
      if (row.requestedSourceVersion)
        await queue(req, {
          sourceCollection: row.sourceCollection,
          sourceId: row.sourceId,
          locale: row.locale,
          sourceVersion: row.requestedSourceVersion,
        })
    }
  }

  const task: TaskConfig<{ input: TranslationInput; output: { skipped: boolean } }> = {
    slug: 'translateDocument',
    inputSchema: ['sourceCollection', 'sourceId', 'locale', 'sourceVersion'].map((name) => ({
      name,
      type: 'text',
      required: true,
    })),
    outputSchema: [{ name: 'skipped', type: 'checkbox' }],
    concurrency: {
      key: ({ input }) => `${input.sourceCollection}:${input.sourceId}:${input.locale}`,
      supersedes: true,
    },
    retries: {
      attempts: retries,
      backoff: { type: 'exponential', delay: options.retryDelay ?? 1000 },
    },
    handler: execute,
  }
  const recoveryTask: TaskConfig<{ input: Record<string, never>; output: Record<string, never> }> =
    {
      slug: 'resumeTranslationQuota',
      schedule: [{ cron: '0 0 * * *', queue: TRANSLATION_QUEUE }],
      retries: 2,
      handler: async ({ req }) => {
        await recover(req)
        return { output: {} }
      },
    }
  return { canQueue, targets, queue, cleanup, recover, tasks: [task, recoveryTask] }
}

export type TranslationRuntime = ReturnType<typeof createTranslationRuntime>
