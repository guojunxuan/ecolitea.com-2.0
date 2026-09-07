import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCachedGlobalMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({ getCachedGlobal: getCachedGlobalMock }))

import { Footer } from '@/Footer/Component'

afterEach(() => {
  cleanup()
  getCachedGlobalMock.mockReset()
})

describe('Footer Payload relationship depth', () => {
  it('renders a populated social platform icon from the depth-two site-settings shape', async () => {
    const calls: Array<[string, number]> = []
    getCachedGlobalMock.mockImplementation((slug: string, depth: number) => {
      calls.push([slug, depth])
      return async () => {
        if (slug === 'footer') return { id: 'footer', columns: [] }
        return {
          id: 'site-settings',
          siteName: 'Ecolitea',
          socialLinks: [
            {
              id: 'linkedin-row',
              platform: {
                id: 'linkedin',
                platform: 'LinkedIn',
                icon: {
                  id: 'linkedin-icon',
                  alt: 'LinkedIn',
                  createdAt: '2026-09-01T00:00:00.000Z',
                  updatedAt: '2026-09-01T01:02:03.000Z',
                  url: '/api/brand-assets/file/linkedin.svg',
                  width: 24,
                  height: 24,
                },
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
              },
              url: 'https://www.linkedin.com/company/ecolitea',
            },
          ],
        }
      }
    })

    render(await Footer())

    expect(calls).toEqual([
      ['footer', 1],
      ['site-settings', 2],
    ])
    const socialLink = screen.getByRole('link', { name: 'LinkedIn' })
    const icon = socialLink.querySelector('img')
    expect(icon?.getAttribute('src')).toContain('/api/brand-assets/file/linkedin.svg')
    expect(icon?.getAttribute('width')).toBe('24')
    expect(icon?.getAttribute('height')).toBe('24')
  })
})
