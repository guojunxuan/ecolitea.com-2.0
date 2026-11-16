// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { createTranslationRuntime } from '@/plugins/translation/task'

const settings = vi.hoisted(() => ({
  value: {
    gtm: { containerId: null, disabled: false },
    translate: {
      apiKey: null as string | null,
      status: 'missing' as 'missing' | 'configured' | 'undecryptable',
      monthlyCharLimit: 450000,
    },
  },
  translate: vi.fn(async ({ texts }: { texts: string[]; key: string }) =>
    texts.map((text) => `DE ${text}`),
  ),
}))
vi.mock('@/SiteSettings/integrations', () => ({ getIntegrations: async () => settings.value }))
vi.mock('@/plugins/translation/provider/stub', () => ({
  createTranslationProvider: (key: string) => ({
    translate: (input: { texts: string[] }) => settings.translate({ ...input, key }),
  }),
}))

function fixture() {
  let translation: Record<string, unknown> | undefined
  const source = { id: 'page', title: 'Tea', slug: 'tea', updatedAt: 'v1', _status: 'published' }
  const warn = vi.fn()
  const payload = {
    config: { globals: [] },
    collections: { pages: { config: { slug: 'pages', versions: { drafts: true } } } },
    logger: { warn },
    findByID: vi.fn(async () => source),
    find: vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'translations' && translation ? [translation] : [],
    })),
    findGlobal: vi.fn(async () => ({ month: '2026-11', characters: 0 })),
    updateGlobal: vi.fn(async () => ({})),
    create: vi.fn(
      async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        if (collection === 'translations') translation = { id: 'translation', ...data }
        return { id: 'translation', ...data }
      },
    ),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      translation = { ...translation, ...data }
      return translation
    }),
    jobs: { queue: vi.fn(async () => ({})) },
  } as unknown as Payload
  const req = { payload, context: {} } as PayloadRequest
  const input = { sourceCollection: 'pages', sourceId: 'page', locale: 'de', sourceVersion: 'v1' }
  return { payload, req, input, warn, row: () => translation }
}

beforeEach(() => {
  settings.value.translate = { apiKey: null, status: 'missing', monthlyCharLimit: 450000 }
  vi.clearAllMocks()
})

describe('translation integrations resolve at operation time', () => {
  it('enables an existing runtime after a key is configured and stops after removal', async () => {
    const runtime = createTranslationRuntime({ targets: ['de'] })
    const { payload, req, input } = fixture()
    expect(await runtime.queue(req, input)).toBe(false)
    settings.value.translate = {
      apiKey: 'test-first-key',
      status: 'configured',
      monthlyCharLimit: 10,
    }
    expect(await runtime.queue(req, input)).toBe(true)
    expect(payload.jobs.queue).toHaveBeenCalledOnce()
    settings.value.translate = { apiKey: null, status: 'missing', monthlyCharLimit: 10 }
    expect(await runtime.queue(req, input)).toBe(false)
    expect(payload.jobs.queue).toHaveBeenCalledOnce()
  })

  it.each(['missing', 'undecryptable'] as const)(
    'skips queued work when the key is %s',
    async (status) => {
      const runtime = createTranslationRuntime({ targets: ['de'] })
      const { req, input, warn } = fixture()
      settings.value.translate.status = status
      const task = runtime.tasks[0].handler
      if (typeof task === 'string') throw new Error('Expected an inline task')
      expect(await task({ input, req, job: {} } as never)).toEqual({ output: { skipped: true } })
      expect(settings.translate).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(status))
    },
  )

  it('uses the latest key and monthly limit when previously queued work executes', async () => {
    const runtime = createTranslationRuntime({
      targets: ['de'],
      invalidate: async () => undefined,
      now: () => new Date('2026-11-16'),
    })
    const { payload, req, input, row } = fixture()
    settings.value.translate = { apiKey: 'test-old-key', status: 'configured', monthlyCharLimit: 1 }
    await runtime.queue(req, input)
    settings.value.translate = { apiKey: 'test-new-key', status: 'configured', monthlyCharLimit: 3 }
    const task = runtime.tasks[0].handler
    if (typeof task === 'string') throw new Error('Expected an inline task')
    expect(await task({ input, req, job: {} } as never)).toEqual({ output: { skipped: false } })
    expect(settings.translate).toHaveBeenCalledWith(
      expect.objectContaining({ texts: ['Tea'], key: 'test-new-key' }),
    )
    expect(payload.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'translation-usage',
        data: { month: '2026-11', characters: 3 },
      }),
    )
    expect(row()).toMatchObject({ status: 'ready', fields: { title: 'DE Tea' } })
  })

  it('honors a lowered monthly limit before sending provider requests', async () => {
    const runtime = createTranslationRuntime({ targets: ['de'], invalidate: async () => undefined })
    const { req, input, row } = fixture()
    settings.value.translate = { apiKey: 'test-key', status: 'configured', monthlyCharLimit: 3 }
    await runtime.queue(req, input)
    settings.value.translate.monthlyCharLimit = 2
    const task = runtime.tasks[0].handler
    if (typeof task === 'string') throw new Error('Expected an inline task')
    await task({ input, req, job: {} } as never)
    expect(settings.translate).not.toHaveBeenCalled()
    expect(row()).toMatchObject({ status: 'waiting_quota' })
  })
})
