import { afterAll, describe, expect, it, vi } from 'vitest'

import { generateMeta } from '@/utilities/generateMeta'

vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://site.example.invalid')

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('generateMeta media URLs', () => {
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
