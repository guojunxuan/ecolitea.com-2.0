import { describe, expect, it, vi } from 'vitest'
vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => ({
    publicLocales: [{ code: 'en' }],
    targetLocales: [{ code: 'fr' }],
    regions: [],
  }),
}))
vi.mock('geist/font/mono', () => ({ GeistMono: { variable: '' } }))
vi.mock('geist/font/sans', () => ({ GeistSans: { variable: '' } }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))
vi.mock('@payload-config', () => ({ default: {} }))
import RootLayout from '@/app/(frontend)/[lang]/layout'

describe('final locale availability boundary', () => {
  it.each(['fr', 'de', 'zh-tw'])('returns final 404 for translating/off %s', async (lang) => {
    await expect(RootLayout({ children: null, params: Promise.resolve({ lang }) })).rejects.toThrow(
      'NEXT_HTTP_ERROR_FALLBACK;404',
    )
  })
})
