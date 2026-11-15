import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`307:${path}`) }, permanentRedirect: (path: string) => { throw new Error(`308:${path}`) } }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedSiteSettings: async () => ({ privacyPolicyPage: { slug: 'privacy' } }) }))
import { enforceLegalLocale, fallbackToEnglish } from '@/utilities/i18n/pageAccess'
describe('approved Next page redirect semantics', () => {
  it('redirects an untranslated public source temporarily, preserving nonexistent 404s', async () => {
    await expect(fallbackToEnglish(null, 'de', '/about', async () => ({}))).rejects.toThrow('307:/about')
    expect(await fallbackToEnglish(null, 'de', '/missing', async () => null)).toBeNull()
  })
  it('redirects localized legal pages permanently while leaving English alone', async () => {
    await expect(enforceLegalLocale('/privacy', 'de')).rejects.toThrow('308:/privacy')
    await expect(enforceLegalLocale('/privacy', 'en')).resolves.toBeUndefined()
  })
})
