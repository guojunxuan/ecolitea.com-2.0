import { describe, expect, it, vi } from 'vitest'
vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => ({
    publicLocales: [{ code: 'en' }],
    targetLocales: [{ code: 'fr' }],
    regions: [],
  }),
}))
vi.mock('geist/font/mono', () => ({ GeistMono: { variable: '' } }))
vi.mock('next/font/google', () => ({ Inter: () => ({ variable: 'font-inter-variable' }) }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/SiteSettings/integrations', () => ({ getIntegrations: async () => ({ gtm: {} }) }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedSiteSettings: async () => ({}) }))
vi.mock('@/utilities/i18n/pageAccess', () => ({ legalPagePaths: async () => [] }))
import RootLayout from '@/app/(frontend)/[lang]/layout'

describe('final locale availability boundary', () => {
  it('sets the Inter font variable on the public layout', async () => {
    const layout = await RootLayout({ children: null, params: Promise.resolve({ lang: 'en' }) })
    expect(layout.props.className).toContain('font-inter-variable')
  })

  it.each(['fr', 'de', 'zh-tw'])('returns final 404 for translating/off %s', async (lang) => {
    await expect(RootLayout({ children: null, params: Promise.resolve({ lang }) })).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404',
    )
  })
})
