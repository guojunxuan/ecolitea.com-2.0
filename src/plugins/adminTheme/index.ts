import type { Config } from 'payload'

import { adminIconEndpoint } from './adminIcon'
import { adminDashboard } from './dashboard/config'
import type { AdminThemeOptions } from './types'

const basePath = '@/plugins/adminTheme'
const icon = `${basePath}/brand/AdminIcon#AdminIcon`
const description = 'Site administration'

export const adminThemePlugin =
  ({ enabled = true, enhancedLayout = false }: AdminThemeOptions = {}) =>
  (config: Config): Config => {
    if (!enabled) return config

    const { admin } = config
    const { components, meta } = admin ?? {}

    return {
      ...config,
      admin: {
        ...admin,
        theme: 'all',
        dashboard: adminDashboard,
        meta: {
          ...meta,
          titleSuffix: ' · Admin',
          defaultOGImageType: 'off',
          description,
          openGraph: { ...meta?.openGraph, siteName: 'Admin', description },
          icons: [{ url: `${config.routes?.api ?? '/api'}${adminIconEndpoint.path}` }],
        },
        components: {
          ...components,
          providers: [
            ...(components?.providers ?? []),
            `${basePath}/ThemeStyles#ThemeStyles`,
            ...(enhancedLayout ? [`${basePath}/EnhancedLayoutStyles#EnhancedLayoutStyles`] : []),
          ],
          graphics: {
            ...components?.graphics,
            Logo: `${basePath}/brand/AdminLogo#AdminLogo`,
            Icon: icon,
          },
          // The native sidebar does not render graphics.Icon in the installed canary.
          // The search entry opens Payload's own command palette; the user card sits below the links.
          beforeNavLinks: [
            ...(components?.beforeNavLinks ?? []),
            { path: icon, serverProps: { showName: true } },
            `${basePath}/sidebar/SidebarSearch#SidebarSearch`,
          ],
          afterNav: [...(components?.afterNav ?? []), `${basePath}/sidebar/UserCard#UserCard`],
        },
      },
      endpoints: [...(config.endpoints ?? []), adminIconEndpoint],
    }
  }
