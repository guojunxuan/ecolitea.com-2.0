import type { DashboardConfig } from 'payload'
import { getSiteSetup } from './getSiteSetup'

export const adminDashboard: DashboardConfig = {
  widgets: [
    { slug: 'site-setup', label: 'Site setup', Component: '@/plugins/adminTheme/dashboard/SiteSetup#SiteSetup' },
    { slug: 'overview', label: 'Overview', Component: '@/plugins/adminTheme/dashboard/Overview#Overview' },
    { slug: 'recent-quotes', label: 'Recent quote requests', Component: '@/plugins/adminTheme/dashboard/RecentQuotes#RecentQuotes' },
    { slug: 'system-status', label: 'System status', Component: '@/plugins/adminTheme/dashboard/SystemStatus#SystemStatus' },
    { slug: 'quick-actions', label: 'Quick actions', Component: '@/plugins/adminTheme/dashboard/QuickActions#QuickActions' },
  ],
  defaultLayout: async ({ req }) => {
    const setup = await getSiteSetup(req)
    const admin = req.user?.role === 'admin'
    return [
      ...(setup === 'incomplete' || setup === 'unavailable'
        ? [{ widgetSlug: 'site-setup', width: 'full' } as const]
        : []),
      { widgetSlug: 'overview', width: 'full' },
      { widgetSlug: 'recent-quotes', width: admin ? 'large' : 'full' },
      // In canary.29, large and small use two thirds and one third of a row.
      ...(admin ? [{ widgetSlug: 'system-status', width: 'small' } as const] : []),
      { widgetSlug: 'quick-actions', width: 'full' },
    ]
  },
}
