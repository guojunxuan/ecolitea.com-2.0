import type { Config, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { adminThemePlugin } from '@/plugins/adminTheme'

const nativeConfig: Config = {
  secret: 'config-contract',
  db: {
    name: 'test',
    defaultIDType: 'text',
    init: () => {
      throw new Error('The contract needs no database')
    },
  },
  admin: { user: 'users', importMap: { baseDir: '/project' } },
}

describe('Admin theme plugin config', () => {
  it('leaves a native config untouched when disabled, even with enhanced layout requested', () => {
    const disabled = adminThemePlugin({ enabled: false, enhancedLayout: true })(nativeConfig)

    expect(disabled).toBe(nativeConfig)
    expect(disabled.admin).toEqual({ user: 'users', importMap: { baseDir: '/project' } })
    expect(disabled.endpoints).toBeUndefined()
  })

  it('appends its providers, sidebar brand and endpoint, while preserving unrelated settings', () => {
    const existingEndpoint = {
      method: 'get' as const,
      path: '/existing',
      handler: () => new Response(),
    }
    const config: Config = {
      ...nativeConfig,
      admin: {
        ...nativeConfig.admin,
        meta: { keywords: ['existing'] },
        components: {
          providers: ['/custom/Provider'],
          beforeNavLinks: ['/custom/BeforeNav'],
          actions: ['/custom/Action'],
        },
      },
      endpoints: [existingEndpoint],
    }

    const active = adminThemePlugin()(config)
    expect(active.admin).toMatchObject({
      ...nativeConfig.admin,
      theme: 'all',
      meta: { titleSuffix: ' · Admin', keywords: ['existing'], icons: [{ url: '/api/admin-icon' }] },
      components: {
        actions: ['/custom/Action'],
        providers: ['/custom/Provider', '@/plugins/adminTheme/ThemeStyles#ThemeStyles'],
        beforeNavLinks: [
          '/custom/BeforeNav',
          { path: '@/plugins/adminTheme/brand/AdminIcon#AdminIcon', serverProps: { showName: true } },
          '@/plugins/adminTheme/sidebar/SidebarSearch#SidebarSearch',
        ],
        graphics: {
          Logo: '@/plugins/adminTheme/brand/AdminLogo#AdminLogo',
          Icon: '@/plugins/adminTheme/brand/AdminIcon#AdminIcon',
        },
      },
      dashboard: { defaultLayout: expect.any(Function), widgets: expect.any(Array) },
    })
    expect(active.admin?.components?.Nav).toBeUndefined()
    expect(active.endpoints).toEqual([
      existingEndpoint,
      { method: 'get', path: '/admin-icon', handler: expect.any(Function) },
    ])
    expect(config.admin?.components?.providers).toEqual(['/custom/Provider'])
    expect(config.endpoints).toEqual([existingEndpoint])
  })

  it('registers the enhanced stylesheet provider only when explicitly enabled', () => {
    const baseProvider = '@/plugins/adminTheme/ThemeStyles#ThemeStyles'
    const enhancedProvider = '@/plugins/adminTheme/EnhancedLayoutStyles#EnhancedLayoutStyles'
    expect(adminThemePlugin()(nativeConfig).admin?.components?.providers).toEqual([baseProvider])
    expect(adminThemePlugin({ enhancedLayout: false })(nativeConfig).admin?.components?.providers)
      .toEqual([baseProvider])
    expect(adminThemePlugin({ enhancedLayout: true })(nativeConfig).admin?.components?.providers)
      .toEqual([baseProvider, enhancedProvider])
  })
})

describe('Admin favicon endpoint', () => {
  const handler = adminThemePlugin()(nativeConfig).endpoints!.find(
    ({ method, path }) => method === 'get' && path === '/admin-icon',
  )!.handler

  it.each([
    [{ url: '/api/site-assets/file/mark.svg', updatedAt: '2026-11-20T00:00:00Z' },
      '/api/site-assets/file/mark.svg?2026-11-20T00%3A00%3A00Z'],
    ['unpopulated-asset-id', '/favicon.svg'],
    [null, '/favicon.svg'],
  ])('redirects the favicon %j with no response body and no caching', async (favicon, location) => {
    const findGlobal = vi.fn().mockResolvedValue({ favicon, privateSetting: 'ignored' })
    const req = { payload: { findGlobal } } as unknown as PayloadRequest

    const response = await handler(req)

    expect(findGlobal).toHaveBeenCalledExactlyOnceWith({
      slug: 'site-settings',
      depth: 1,
      overrideAccess: false,
      select: { favicon: true },
      req,
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(location)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe('')
  })
})
