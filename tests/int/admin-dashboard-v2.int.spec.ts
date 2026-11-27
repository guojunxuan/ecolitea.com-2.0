import type { PayloadRequest, SanitizedPermissions } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/plugins/translation/admin/getTranslationStatus', () => ({ getTranslationStatus: vi.fn() }))

import { getTranslationStatus } from '@/plugins/translation/admin/getTranslationStatus'
import { getContentActivity } from '@/plugins/adminTheme/dashboard/getContentActivity'
import { getDashboardHeader } from '@/plugins/adminTheme/dashboard/getDashboardHeader'
import { getSystemStatus } from '@/plugins/adminTheme/dashboard/getSystemStatus'
import { getTranslationSummary, summarizeTranslations } from '@/plugins/adminTheme/dashboard/summarizeTranslations'

const statusMock = vi.mocked(getTranslationStatus)

function fixture(role = 'admin', timezone?: string) {
  const count = vi.fn()
  const find = vi.fn()
  const findGlobal = vi.fn()
  const req = {
    user: { role },
    payload: {
      count, find, findGlobal,
      collections: { 'payload-jobs': {}, translations: {} },
      config: {
        routes: { admin: '/admin' },
        admin: { timezones: timezone ? { defaultTimezone: timezone } : {} },
        collections: [],
        globals: [{ slug: 'site-settings' }],
        jobs: { tasks: [{ slug: 'schedulePublish' }] },
      },
    },
  } as unknown as PayloadRequest
  return { req, count, find, findGlobal }
}

const row = (code: string, status: string, total: number, ready: number, failed = 0, waiting = 0) =>
  ({ code, label: code, status, total, ready, failed, waiting, updated: undefined })

describe('getContentActivity', () => {
  const now = new Date('2026-11-21T10:30:00Z')

  it('counts documents updated per UTC day for the last seven days, oldest first', async () => {
    const { req, count } = fixture()
    count.mockImplementation(async ({ collection, where }) => {
      const start = where.and[0].updatedAt.greater_than_equal as string
      // Products update on the 18th and 21st, blogs on the 21st, pages never.
      const day = start.slice(0, 10)
      if (collection === 'products') return { totalDocs: day === '2026-11-18' ? 2 : day === '2026-11-21' ? 1 : 0 }
      if (collection === 'blogs') return { totalDocs: day === '2026-11-21' ? 3 : 0 }
      return { totalDocs: 0 }
    })

    const activity = await getContentActivity(req, now)

    expect(activity?.days).toEqual([
      { date: '2026-11-15', count: 0 },
      { date: '2026-11-16', count: 0 },
      { date: '2026-11-17', count: 0 },
      { date: '2026-11-18', count: 2 },
      { date: '2026-11-19', count: 0 },
      { date: '2026-11-20', count: 0 },
      { date: '2026-11-21', count: 4 },
    ])
    expect(activity?.total).toBe(6)
    expect(count).toHaveBeenCalledTimes(21)
    expect(count.mock.calls.map(([options]) => options.collection).sort()).toEqual([
      ...Array(7).fill('blogs'), ...Array(7).fill('pages'), ...Array(7).fill('products'),
    ])
    const first = count.mock.calls.find(([options]) => options.collection === 'products')![0]
    expect(first).toMatchObject({
      req, overrideAccess: false, disableErrors: true,
      where: { and: [
        { updatedAt: { greater_than_equal: '2026-11-15T00:00:00.000Z' } },
        { updatedAt: { less_than: '2026-11-16T00:00:00.000Z' } },
      ] },
    })
  })

  it('reports an unavailable query instead of a partial chart', async () => {
    const { req, count } = fixture()
    count.mockResolvedValueOnce({ totalDocs: 1 }).mockRejectedValue(new Error('count failed'))
    expect(await getContentActivity(req, now)).toBeNull()
  })
})

describe('summarizeTranslations', () => {
  it('returns null when no language is enabled', () => {
    expect(summarizeTranslations([])).toBeNull()
    expect(summarizeTranslations([row('de', 'off', 4, 0)])).toBeNull()
  })

  it('classifies each enabled language as synced, in progress or failed', () => {
    expect(summarizeTranslations([
      row('de', 'live', 4, 4),
      row('fr', 'translating', 4, 2),
      row('ja', 'live', 4, 3, 1),
      row('es', 'live', 4, 4, 0, 1),
      row('it', 'off', 4, 0),
      row('nl', 'live', 0, 0),
    ])).toEqual({ enabled: 5, synced: 2, inProgress: 2, failed: 1, percent: 40 })
  })

  it('rounds the synced share of the enabled languages', () => {
    expect(summarizeTranslations([row('de', 'live', 1, 1), row('fr', 'live', 1, 0), row('ja', 'live', 1, 0)]))
      .toMatchObject({ synced: 1, enabled: 3, percent: 33 })
  })
})

describe('getTranslationSummary', () => {
  beforeEach(() => statusMock.mockReset())

  it('is hidden from editors and never reads translation data for them', async () => {
    const { req } = fixture('editor')
    expect(await getTranslationSummary(req)).toEqual({ status: 'hidden' })
    expect(statusMock).not.toHaveBeenCalled()
  })

  it('distinguishes empty, ready and unavailable', async () => {
    const { req } = fixture()
    statusMock.mockResolvedValueOnce({ counts: [row('de', 'off', 1, 0)] } as never)
    expect(await getTranslationSummary(req)).toEqual({ status: 'empty' })
    statusMock.mockResolvedValueOnce({ counts: [row('de', 'live', 2, 2)] } as never)
    expect(await getTranslationSummary(req)).toEqual({
      status: 'ready', enabled: 1, synced: 1, inProgress: 0, failed: 0, percent: 100,
    })
    statusMock.mockRejectedValueOnce(new Error('offline'))
    expect(await getTranslationSummary(req)).toEqual({ status: 'unavailable' })
  })

  it('is empty when the translations collection does not exist', async () => {
    const { req } = fixture()
    ;(req.payload as unknown as { collections: object }).collections = {}
    expect(await getTranslationSummary(req)).toEqual({ status: 'empty' })
    expect(statusMock).not.toHaveBeenCalled()
  })
})

describe('getDashboardHeader', () => {
  const permissions = (...create: string[]) => ({
    collections: Object.fromEntries(create.map((slug) => [slug, { fields: {}, create: true }])),
  }) as unknown as SanitizedPermissions

  it('names the site, formats the date in the configured timezone and picks the first create action', async () => {
    const { req, findGlobal } = fixture('admin', 'Asia/Tokyo')
    findGlobal.mockResolvedValue({ siteName: '  Tea Studio  ', private: 'ignored' })

    expect(await getDashboardHeader(req, permissions('blogs', 'media'), new Date('2026-11-20T20:00:00Z'))).toEqual({
      siteName: 'Tea Studio',
      date: '21 Nov 2026',
      dateTime: '2026-11-21',
      action: { collection: 'blogs', href: '/admin/collections/blogs/create', label: 'New blog' },
    })
    expect(findGlobal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      slug: 'site-settings', overrideAccess: false, select: { siteName: true }, req,
    }))
  })

  it('omits a blank or unreadable site name and falls back to UTC', async () => {
    const { req, findGlobal } = fixture()
    findGlobal.mockResolvedValueOnce({ siteName: '   ' }).mockRejectedValueOnce(new Error('settings failed'))
    const now = new Date('2026-11-20T23:30:00Z')
    expect(await getDashboardHeader(req, permissions(), now)).toEqual({ date: '20 Nov 2026', dateTime: '2026-11-20' })
    expect(await getDashboardHeader(req, permissions('products'), now)).toEqual({
      date: '20 Nov 2026', dateTime: '2026-11-20',
      action: { collection: 'products', href: '/admin/collections/products/create', label: 'New product' },
    })
  })

  it('ignores an unknown timezone instead of failing the dashboard', async () => {
    const { req, findGlobal } = fixture('admin', 'Not/AZone')
    findGlobal.mockResolvedValue({})
    expect((await getDashboardHeader(req, permissions(), new Date('2026-11-20T23:30:00Z'))).date).toBe('20 Nov 2026')
  })
})

describe('system status overall state', () => {
  beforeEach(() => statusMock.mockReset())

  function services(failed: number) {
    const { req, find, findGlobal } = fixture()
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('DISABLE_R2_STORAGE', 'true')
    findGlobal.mockResolvedValue({
      languages: [{ code: 'de', status: 'live' }],
      smtpHost: 'private-host', smtpUser: 'private-user', smtpFromAddress: 'test@example.invalid',
    })
    find.mockResolvedValue({ docs: [] })
    ;(req.payload.count as ReturnType<typeof vi.fn>).mockResolvedValue({ totalDocs: 0 })
    statusMock.mockResolvedValue({ counts: [row('de', 'live', 3, 3 - failed, failed)] } as never)
    return req
  }

  it('is normal when nothing needs attention', async () => {
    try {
      expect(await getSystemStatus(services(0))).toMatchObject({ overall: 'normal', translation: '0 in progress · 0 failed' })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('needs attention when a translation failed', async () => {
    try {
      expect(await getSystemStatus(services(2))).toMatchObject({ overall: 'attention', translation: '0 in progress · 2 failed' })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('treats unconfigured services as neutral, not as a problem', async () => {
    const { req, find, findGlobal } = fixture()
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('DISABLE_R2_STORAGE', 'true')
    try {
      findGlobal.mockResolvedValue({ languages: [] })
      find.mockResolvedValue({ docs: [] })
      expect(await getSystemStatus(req)).toMatchObject({ overall: 'normal', email: 'Not configured', translation: 'Not configured' })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
