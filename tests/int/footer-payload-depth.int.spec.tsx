import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCachedFooterMock = vi.hoisted(() => vi.fn())
const getCachedSiteSettingsMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({
  getCachedFooter: getCachedFooterMock,
  getCachedSiteSettings: getCachedSiteSettingsMock,
}))

import { Footer } from '@/Footer/Component'

afterEach(() => {
  cleanup()
  getCachedFooterMock.mockReset()
  getCachedSiteSettingsMock.mockReset()
})

describe('Footer Payload relationship depth', () => {
  it('renders a populated social platform icon from the depth-two site-settings shape', async () => {
    getCachedFooterMock.mockResolvedValue({ id: 'footer', columns: [] })
    getCachedSiteSettingsMock.mockResolvedValue({
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
    })

    render(await Footer())

    expect(getCachedFooterMock).toHaveBeenCalledOnce()
    expect(getCachedSiteSettingsMock).toHaveBeenCalledOnce()
    const socialLink = screen.getByRole('link', { name: 'LinkedIn' })
    const icon = socialLink.querySelector('img')
    expect(icon?.getAttribute('src')).toContain('/api/brand-assets/file/linkedin.svg')
    expect(icon?.getAttribute('width')).toBe('24')
    expect(icon?.getAttribute('height')).toBe('24')
  })
})
