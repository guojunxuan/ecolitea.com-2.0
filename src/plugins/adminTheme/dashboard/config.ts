import type { DashboardConfig } from 'payload'
import { getSiteSetup } from './getSiteSetup'

const base = '@/plugins/adminTheme/dashboard'

export const adminDashboard: DashboardConfig = {
  widgets: [
    { slug: 'dashboard-header', label: 'Dashboard header', Component: `${base}/DashboardHeader#DashboardHeader` },
    { slug: 'site-setup', label: 'Site setup', Component: `${base}/SiteSetup#SiteSetup` },
    { slug: 'overview', label: 'Overview', Component: `${base}/Overview#Overview` },
    { slug: 'recent-quotes', label: 'Recent quote requests', Component: `${base}/RecentQuotes#RecentQuotes` },
    { slug: 'translations', label: 'Translations', Component: `${base}/Translations#Translations` },
    { slug: 'content-activity', label: 'Content activity', Component: `${base}/ContentActivity#ContentActivity` },
    { slug: 'system-status', label: 'System status', Component: `${base}/SystemStatus#SystemStatus` },
    { slug: 'quick-actions', label: 'Quick actions', Component: `${base}/QuickActions#QuickActions` },
  ],
  // Widths follow the installed WidgetWidth scale: small is a third of a row, medium a half.
  defaultLayout: async ({ req }) => {
    const setup = await getSiteSetup(req)
    const admin = req.user?.role === 'admin'
    return [
      { widgetSlug: 'dashboard-header', width: 'full' },
      ...(setup === 'incomplete' || setup === 'unavailable'
        ? [{ widgetSlug: 'site-setup', width: 'full' } as const]
        : []),
      { widgetSlug: 'overview', width: 'full' },
      ...(admin
        ? ([
            { widgetSlug: 'recent-quotes', width: 'small' },
            { widgetSlug: 'translations', width: 'small' },
            { widgetSlug: 'content-activity', width: 'small' },
            { widgetSlug: 'system-status', width: 'medium' },
            { widgetSlug: 'quick-actions', width: 'medium' },
          ] as const)
        : ([
            { widgetSlug: 'recent-quotes', width: 'medium' },
            { widgetSlug: 'content-activity', width: 'medium' },
            { widgetSlug: 'quick-actions', width: 'full' },
          ] as const)),
    ]
  },
}
