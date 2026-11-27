import { cleanup, render, screen, within } from '@testing-library/react'
import type { PayloadRequest, SanitizedPermissions } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const data = vi.hoisted(() => ({
  header: vi.fn(),
  overview: vi.fn(),
  quotes: vi.fn(),
  activity: vi.fn(),
  translations: vi.fn(),
  system: vi.fn(),
  setup: vi.fn(),
}))
vi.mock('@/plugins/adminTheme/dashboard/getDashboardHeader', () => ({ getDashboardHeader: data.header }))
vi.mock('@/plugins/adminTheme/dashboard/getOverview', () => ({ getOverview: data.overview }))
vi.mock('@/plugins/adminTheme/dashboard/getRecentQuotes', () => ({ getRecentQuotes: data.quotes }))
vi.mock('@/plugins/adminTheme/dashboard/getContentActivity', () => ({ getContentActivity: data.activity }))
vi.mock('@/plugins/adminTheme/dashboard/summarizeTranslations', () => ({ getTranslationSummary: data.translations }))
vi.mock('@/plugins/adminTheme/dashboard/getSystemStatus', () => ({ getSystemStatus: data.system }))
vi.mock('@/plugins/adminTheme/dashboard/getSiteSetup', () => ({ getSiteSetup: data.setup }))

import { adminDashboard } from '@/plugins/adminTheme/dashboard/config'
import { ContentActivity } from '@/plugins/adminTheme/dashboard/ContentActivity'
import { DashboardHeader } from '@/plugins/adminTheme/dashboard/DashboardHeader'
import { Overview } from '@/plugins/adminTheme/dashboard/Overview'
import { QuickActions } from '@/plugins/adminTheme/dashboard/QuickActions'
import { RecentQuotes } from '@/plugins/adminTheme/dashboard/RecentQuotes'
import { SystemStatus } from '@/plugins/adminTheme/dashboard/SystemStatus'
import { Translations } from '@/plugins/adminTheme/dashboard/Translations'

const req = { user: { role: 'admin' }, payload: { config: { routes: { admin: '/admin' } } } } as unknown as PayloadRequest
const permissions = (...create: string[]) => ({
  collections: Object.fromEntries(create.map((slug) => [slug, { fields: {}, create: true }])),
}) as unknown as SanitizedPermissions
const props = { req, permissions: permissions('products', 'blogs', 'media'), widgetSlug: 'x' } as never

beforeEach(() => Object.values(data).forEach((mock) => mock.mockReset()))
afterEach(cleanup)

describe('dashboard widget registration', () => {
  it('registers the new widgets alongside the existing ones', () => {
    expect(adminDashboard.widgets.map(({ slug }) => slug)).toEqual([
      'dashboard-header', 'site-setup', 'overview', 'recent-quotes', 'translations',
      'content-activity', 'system-status', 'quick-actions',
    ])
    for (const { Component } of adminDashboard.widgets) {
      expect(Component).toMatch(/^@\/plugins\/adminTheme\/dashboard\/\w+#\w+$/)
    }
  })

  const layout = async (role: string, setup = 'complete') => {
    data.setup.mockResolvedValue(setup)
    const result = typeof adminDashboard.defaultLayout === 'function'
      ? await adminDashboard.defaultLayout({ req: { ...req, user: { role } } as PayloadRequest })
      : adminDashboard.defaultLayout!
    return result.map(({ widgetSlug, width }) => `${widgetSlug}:${width}`)
  }

  it('lays out the administrator dashboard in the demo rows', async () => {
    expect(await layout('admin')).toEqual([
      'dashboard-header:full', 'overview:full',
      'recent-quotes:small', 'translations:small', 'content-activity:small',
      'system-status:medium', 'quick-actions:medium',
    ])
  })

  it('shows the setup banner under the header only while setup is incomplete', async () => {
    expect((await layout('admin', 'incomplete')).slice(0, 3)).toEqual([
      'dashboard-header:full', 'site-setup:full', 'overview:full',
    ])
  })

  it('omits administrator-only widgets for editors and rebalances the rows', async () => {
    expect(await layout('editor')).toEqual([
      'dashboard-header:full', 'overview:full',
      'recent-quotes:medium', 'content-activity:medium', 'quick-actions:full',
    ])
  })
})

describe('DashboardHeader', () => {
  it('renders the title, site name, date and primary action', async () => {
    data.header.mockResolvedValue({
      siteName: 'Tea Studio', date: '21 Nov 2026', dateTime: '2026-11-21',
      action: { collection: 'products', href: '/admin/collections/products/create', label: 'New product' },
    })
    const { container } = render(await DashboardHeader(props))

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByText('Tea Studio')).toBeTruthy()
    expect(container.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-21')
    expect(screen.getByText('21 Nov 2026')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'New product' }).getAttribute('href')).toBe('/admin/collections/products/create')
  })

  it('omits the site name and action when there is nothing to show', async () => {
    data.header.mockResolvedValue({ date: '21 Nov 2026', dateTime: '2026-11-21' })
    const { container } = render(await DashboardHeader(props))
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('[data-site-name]')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
  })
})

describe('Overview', () => {
  it('shows each metric with a decorative icon', async () => {
    data.overview.mockResolvedValue({ published: 48, drafts: 3, quotes: 3, blogs: 126, languages: 18 })
    const { container } = render(await Overview(props))

    const region = screen.getByRole('region', { name: 'Overview' })
    for (const label of ['Published products', 'New quote requests', 'Blog posts', 'Enabled languages']) {
      expect(within(region).getByText(label)).toBeTruthy()
    }
    expect(within(region).getByText('48')).toBeTruthy()
    expect(within(region).getByText('3 drafts')).toBeTruthy()
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4)
  })

  it('shows Unavailable when the counts failed', async () => {
    data.overview.mockResolvedValue(null)
    render(await Overview(props))
    expect(screen.getByText('Unavailable')).toBeTruthy()
  })
})

describe('Translations', () => {
  it('draws the synced share as a ring with the three counts', async () => {
    data.translations.mockResolvedValue({ status: 'ready', enabled: 18, synced: 16, inProgress: 2, failed: 0, percent: 89 })
    render(await Translations(props))

    const region = screen.getByRole('region', { name: 'Translations' })
    expect(within(region).getByText('16 of 18')).toBeTruthy()
    const ring = within(region).getByRole('img', { name: '89% of enabled languages synced' })
    expect(ring.style.getPropertyValue('--p')).toBe('89')
    expect(within(region).getByText('Synced').nextElementSibling?.textContent).toBe('16')
    expect(within(region).getByText('In progress').nextElementSibling?.textContent).toBe('2')
    expect(within(region).getByText('Failed').nextElementSibling?.textContent).toBe('0')
  })

  it.each([
    ['hidden', null],
    ['empty', 'No languages enabled'],
    ['unavailable', 'Unavailable'],
  ])('handles the %s state', async (status, text) => {
    data.translations.mockResolvedValue({ status })
    const element = await Translations(props)
    if (!text) return expect(element).toBeNull()
    render(element)
    expect(screen.getByText(text)).toBeTruthy()
  })
})

describe('ContentActivity', () => {
  const days = [
    ['2026-11-15', 1], ['2026-11-16', 2], ['2026-11-17', 0], ['2026-11-18', 4],
    ['2026-11-19', 2], ['2026-11-20', 0], ['2026-11-21', 8],
  ].map(([date, count]) => ({ date, count }))

  it('renders seven bars scaled to the busiest day, with the latest day emphasized', async () => {
    data.activity.mockResolvedValue({ days, total: 17 })
    const { container } = render(await ContentActivity(props))

    const bars = [...container.querySelectorAll<HTMLElement>('[data-bar]')]
    expect(bars).toHaveLength(7)
    expect(bars.map((bar) => bar.style.height)).toEqual(['13%', '25%', '8%', '50%', '25%', '8%', '100%'])
    expect(bars.at(-1)?.getAttribute('data-current')).toBe('true')
    expect(bars.filter((bar) => bar.hasAttribute('data-current'))).toHaveLength(1)
    expect(bars[3]?.getAttribute('aria-label')).toBe('Wed 18 Nov: 4 updates')
    expect(bars[0]?.getAttribute('aria-label')).toBe('Sun 15 Nov: 1 update')
    expect(screen.getByText('Last 7 days')).toBeTruthy()
    expect(['S', 'M', 'T', 'W', 'T', 'F', 'S'].every((letter) => screen.getAllByText(letter).length > 0)).toBe(true)
  })

  it('says so when nothing changed and when the query failed', async () => {
    data.activity.mockResolvedValueOnce({ days: days.map(({ date }) => ({ date, count: 0 })), total: 0 })
    const { unmount } = render(await ContentActivity(props))
    expect(screen.getByText('No updates in the last 7 days')).toBeTruthy()
    unmount()
    data.activity.mockResolvedValueOnce(null)
    render(await ContentActivity(props))
    expect(screen.getByText('Unavailable')).toBeTruthy()
  })
})

describe('SystemStatus', () => {
  const status = { email: 'Configured · Site Settings', translation: '0 in progress · 0 failed', storage: 'Local storage', schedule: 'No scheduled publications' }

  it('shows the overall state beside the title', async () => {
    data.system.mockResolvedValueOnce({ ...status, overall: 'normal' })
    const { unmount } = render(await SystemStatus(props))
    expect(screen.getByText('All systems normal')).toBeTruthy()
    expect(screen.getByText('Storage').nextElementSibling?.textContent).toBe('Local storage')
    unmount()
    data.system.mockResolvedValueOnce({ ...status, overall: 'attention' })
    render(await SystemStatus(props))
    expect(screen.getByText('Needs attention')).toBeTruthy()
  })

  it('renders nothing for non-administrators', async () => {
    data.system.mockResolvedValue(null)
    expect(await SystemStatus(props)).toBeNull()
  })
})

describe('QuickActions and RecentQuotes', () => {
  it('renders the permitted actions after the title-row action as icon cards', () => {
    const { container } = render(QuickActions(props) as React.ReactElement)
    const nav = screen.getByRole('navigation', { name: 'Quick actions' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['New blog', 'Upload media'])
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2)
  })

  it('keeps the recent quotes states', async () => {
    data.quotes.mockResolvedValueOnce([])
    const { unmount } = render(await RecentQuotes(props))
    expect(screen.getByText('No quote requests yet')).toBeTruthy()
    unmount()
    data.quotes.mockResolvedValueOnce([
      { id: '1', name: 'Kai', company: 'Studio', product: 'Whisk', status: 'new', createdAt: '2026-11-19T00:00:00Z', relativeTime: '10 minutes ago' },
    ])
    render(await RecentQuotes(props))
    expect(screen.getByText('Kai')).toBeTruthy()
    expect(screen.getByText('New')).toBeTruthy()
  })
})
