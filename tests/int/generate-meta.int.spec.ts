import { afterAll, describe, expect, it, vi } from 'vitest'

import { generateMeta } from '@/utilities/generateMeta'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@payload-config', () => ({ default: {} }))
const { findGlobal } = vi.hoisted(() => ({ findGlobal: vi.fn(async () => ({})) }))

vi.mock('payload', () => ({
  getPayload: async () => ({ findGlobal }),
}))

vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://site.example.invalid')

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('generateMeta', () => {
  it('uses site identity for the title and description and leaves absent images absent', async () => {
    findGlobal.mockResolvedValueOnce({ siteName: 'Tea Studio', siteDescription: 'About the studio' })
    const metadata = await generateMeta({ doc: { meta: { title: 'About' } } })
    expect(metadata).toMatchObject({
      title: 'About | Tea Studio',
      description: 'About the studio',
      openGraph: { siteName: 'Tea Studio', title: 'About | Tea Studio', description: 'About the studio' },
    })
    expect(metadata.openGraph?.images).toBeUndefined()
  })

  it('omits unset identity and keeps a previously generated branded title', async () => {
    const empty = await generateMeta({ doc: null })
    expect(empty.title).toBeUndefined()
    expect(empty.description).toBeUndefined()
    expect(empty.openGraph?.siteName).toBeUndefined()

    findGlobal.mockResolvedValueOnce({ siteName: 'Tea Studio' })
    const branded = await generateMeta({ doc: { meta: { title: 'About | Tea Studio' } } })
    expect(branded.title).toBe('About | Tea Studio')
  })

  it('uses the stored original absolute URL and ignores legacy generated sizes', async () => {
    const metadata = await generateMeta({
      doc: {
        meta: {
          image: {
            url: 'https://media.example.invalid/original.jpg',
            sizes: { og: { url: '/media/legacy-og.jpg' } },
          },
        },
      } as never,
    })

    expect(metadata.openGraph).toMatchObject({
      images: [{ url: 'https://media.example.invalid/original.jpg' }],
    })
  })
})
