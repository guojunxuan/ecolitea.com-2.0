import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { getOverview } from '@/plugins/adminTheme/dashboard/getOverview'
import { getRecentQuotes } from '@/plugins/adminTheme/dashboard/getRecentQuotes'
import { getSystemStatus } from '@/plugins/adminTheme/dashboard/getSystemStatus'
import { getSiteSetup } from '@/plugins/adminTheme/dashboard/getSiteSetup'
import { getQuickActions } from '@/plugins/adminTheme/dashboard/getQuickActions'

function fixture(role = 'admin') {
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
        collections: [],
        globals: [{ slug: 'site-settings' }],
        jobs: { tasks: [{ slug: 'schedulePublish' }] },
      },
    },
  } as unknown as PayloadRequest
  return { req, count, find, findGlobal }
}

describe('Admin dashboard queries', () => {
  it('counts collection records with current access and includes English plus enabled languages', async () => {
    const { req, count, findGlobal } = fixture()
    count.mockResolvedValueOnce({ totalDocs: 7 }).mockResolvedValueOnce({ totalDocs: 2 })
      .mockResolvedValueOnce({ totalDocs: 1 }).mockResolvedValueOnce({ totalDocs: 9 })
    findGlobal.mockResolvedValue({ languages: [{ code: 'de', status: 'translating' }, { code: 'fr', status: 'off' }] })

    expect(await getOverview(req)).toEqual({ published: 7, drafts: 2, quotes: 1, blogs: 9, languages: 2 })
    expect(count.mock.calls.map(([options]) => [options.collection, options.where])).toEqual([
      ['products', { _status: { equals: 'published' } }],
      ['products', { _status: { equals: 'draft' } }],
      ['quote-requests', { status: { equals: 'new' } }],
      ['blogs', undefined],
    ])
    expect(count.mock.calls.every(([options]) => options.req === req && options.overrideAccess === false)).toBe(true)
  })

  it('returns the newest five authorized quotes with safe display data', async () => {
    const { req, find } = fixture()
    find.mockResolvedValue({ docs: [
      { id: '1', name: 'Kai', company: 'Studio', status: 'new', productTitle: 'Snapshot', product: { title: 'Renamed' }, createdAt: '2026-11-19T00:00:00Z', email: 'private@example.invalid' },
      { id: '2', name: 'Liv', company: 'Lab', status: 'closed', product: 'deleted', createdAt: '2026-11-18T00:00:00Z' },
    ] })

    expect(await getRecentQuotes(req, Date.parse('2026-11-19T00:10:00Z'))).toEqual([
      { id: '1', name: 'Kai', company: 'Studio', status: 'new', product: 'Snapshot', createdAt: '2026-11-19T00:00:00Z', relativeTime: '10 minutes ago' },
      { id: '2', name: 'Liv', company: 'Lab', status: 'closed', product: null, createdAt: '2026-11-18T00:00:00Z', relativeTime: 'yesterday' },
    ])
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'quote-requests', sort: '-createdAt', limit: 5, req, overrideAccess: false,
    }))
  })

  it('reports an unavailable query separately from an empty result', async () => {
    const { req, count, find, findGlobal } = fixture()
    count.mockRejectedValue(new Error('count failed'))
    findGlobal.mockResolvedValue({})
    find.mockResolvedValueOnce({ docs: [] }).mockRejectedValueOnce(new Error('find failed'))
    expect(await getOverview(req)).toBeNull()
    expect(await getRecentQuotes(req, Date.parse('2026-11-19T00:10:00Z'))).toEqual([])
    expect(await getRecentQuotes(req)).toBeNull()
  })

  it('checks setup only for admins and hides it after name and logo have been saved', async () => {
    const { req, findGlobal } = fixture()
    findGlobal.mockResolvedValueOnce({ siteName: '   ', logo: 'id' })
      .mockResolvedValueOnce({ siteName: 'Tea Studio', logo: 'id' })
      .mockRejectedValueOnce(new Error('settings failed'))
    expect(await getSiteSetup(req)).toBe('incomplete')
    expect(await getSiteSetup(req)).toBe('complete')
    expect(await getSiteSetup(req)).toBe('unavailable')
    const editor = fixture('editor')
    expect(await getSiteSetup(editor.req)).toBe('hidden')
    expect(editor.findGlobal).not.toHaveBeenCalled()
  })

  it('returns create links only for permitted collections', () => {
    const { req } = fixture('editor')
    expect(getQuickActions(req, {
      collections: { blogs: { fields: {}, read: true }, media: { fields: {}, create: true } },
    })).toEqual([{ href: '/admin/collections/media/create', label: 'Upload media' }])
  })

  it('skips translation inventory when the site has no enabled target languages', async () => {
    const { req, find, findGlobal } = fixture()
    find.mockResolvedValue({ docs: [] })
    findGlobal.mockResolvedValue({ languages: [{ code: 'de', status: 'off' }] })

    expect(await getSystemStatus(req)).toMatchObject({ translation: 'Not configured' })
    expect(findGlobal).not.toHaveBeenCalledWith(expect.objectContaining({ slug: 'translation-usage' }))
  })

  it('summarizes services without credentials and isolates a failed translation lookup', async () => {
    const { req, find, findGlobal } = fixture()
    vi.stubEnv('SMTP_HOST', '')
    vi.stubEnv('DISABLE_R2_STORAGE', 'true')
    try {
      findGlobal.mockImplementation(async ({ slug }) => {
        if (slug === 'translation-usage') throw new Error('translation offline')
        return {
          languages: [{ code: 'de', status: 'live' }],
          smtpHost: 'private-host',
          smtpUser: 'private-user',
          smtpFromAddress: 'test@example.invalid',
        }
      })
      find.mockImplementation(async ({ collection }) =>
        collection === 'payload-jobs' ? { docs: [{ waitUntil: '2026-11-20T09:00:00.000Z' }] } : { docs: [] },
      )
      expect(await getSystemStatus(req)).toEqual({
        email: 'Configured · Site Settings',
        translation: 'Not configured',
        storage: 'Local storage',
        schedule: { next: '2026-11-20T09:00:00.000Z' },
      })
      expect(find).toHaveBeenCalledWith(expect.objectContaining({
        collection: 'payload-jobs', sort: 'waitUntil', limit: 1, req,
        where: expect.objectContaining({
          taskSlug: { equals: 'schedulePublish' },
          completedAt: { exists: false },
          hasError: { not_equals: true },
        }),
      }))
      const editor = fixture('editor')
      expect(await getSystemStatus(editor.req)).toBeNull()
      expect(editor.findGlobal).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
