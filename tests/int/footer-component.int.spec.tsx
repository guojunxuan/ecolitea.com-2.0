import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FooterData } from '@/Footer/types'
import type { Footer as FooterGlobal, SiteSettings } from '@/payload-types'

const getCachedFooterMock = vi.hoisted(() => vi.fn())
const getCachedSiteSettingsMock = vi.hoisted(() => vi.fn())
const adaptFooterMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({
  getCachedFooter: getCachedFooterMock,
  getCachedSiteSettings: getCachedSiteSettingsMock,
}))
vi.mock('@/Footer/adaptFooter', () => ({ adaptFooter: adaptFooterMock }))

import { Footer } from '@/Footer/Component'
import { FooterNavigation } from '@/Footer/Navigation.client'

const footerGlobal: FooterGlobal = { id: 'footer', columns: [] }
const siteSettings: SiteSettings = {
  address: 'Shanghai, China',
  id: 'site-settings',
  legalCompanyName: 'Ecolitea Limited',
  logo: 'unexpanded-logo-id',
  siteName: 'Ecolitea',
  siteDescription: 'Sustainable tea systems.',
  newsletter: {
    enabled: true,
    heading: 'Tea notes',
    description: 'Product launches and practical insights.',
    buttonLabel: 'Subscribe',
    emailPlaceholder: 'Email address',
  },
  phone: '+86 21 5555 5555',
  salesEmail: 'sales@example.com',
  tagline: 'Sustainable tea.',
}
const footerData: FooterData = {
  logo: {
    alt: 'Ecolitea',
    height: 30,
    src: '/ecolitea.svg',
    width: 120,
  },
  siteDescription: 'Sustainable tea systems.',
  columns: [
    {
      id: 'products',
      label: 'Products',
      navItems: [
        { id: 'tea', link: { href: '/tea', label: 'Tea', newTab: false, type: 'custom' } },
      ],
    },
    {
      id: 'solutions',
      label: 'Solutions',
      navItems: [
        { id: 'hotels', link: { href: '/hotels', label: 'Hotels', newTab: false, type: 'custom' } },
      ],
    },
    {
      id: 'resources',
      label: 'Resources',
      navItems: [
        { id: 'news', link: { href: '/posts', label: 'News', newTab: false, type: 'custom' } },
      ],
    },
    {
      id: 'company',
      label: 'Company',
      navItems: [],
    },
  ],
  socialLinks: [
    {
      id: 'linkedin',
      icon: {
        alt: 'LinkedIn',
        height: 24,
        src: '/linkedin.svg',
        width: 24,
      },
      platform: 'LinkedIn',
      url: 'https://linkedin.com/company/ecolitea',
    },
  ],
  contact: {
    address: 'Shanghai, China',
    phone: '+86 21 5555 5555',
    salesEmail: 'sales@example.com',
  },
  newsletter: {
    heading: 'Tea notes',
    description: 'Product launches and practical insights.',
    emailPlaceholder: 'Work email',
    buttonLabel: 'Join the list',
  },
  legalLinks: [
    { href: '/privacy', label: 'Privacy Policy', newTab: false, type: 'reference' },
    { href: '/terms', label: 'Terms', newTab: false, type: 'reference' },
  ],
  copyrightText: '© 2026 Ecolitea. All rights reserved.',
}

afterEach(() => {
  cleanup()
  getCachedFooterMock.mockReset()
  getCachedSiteSettingsMock.mockReset()
  adaptFooterMock.mockReset()
})

describe('Footer server boundary', () => {
  it('loads both canonical readers concurrently and adapts their data exactly once', async () => {
    const pending = new Map<string, (value: unknown) => void>()
    const started: string[] = []
    getCachedFooterMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          started.push('footer')
          pending.set('footer', resolve)
        }),
    )
    getCachedSiteSettingsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          started.push('site-settings')
          pending.set('site-settings', resolve)
        }),
    )
    adaptFooterMock.mockReturnValue(footerData)

    const result = Footer()

    expect(started).toEqual(['footer', 'site-settings'])
    pending.get('footer')?.(footerGlobal)
    pending.get('site-settings')?.(siteSettings)
    const element = await result

    expect(adaptFooterMock).toHaveBeenCalledOnce()
    expect(adaptFooterMock).toHaveBeenCalledWith(footerGlobal, siteSettings)
    expect(getCachedFooterMock).toHaveBeenCalledOnce()
    expect(getCachedSiteSettingsMock).toHaveBeenCalledOnce()
    expect(element.props['data-theme']).toBeUndefined()
    expect(element.props['data-website-theme']).toBe('inverse')
    expect(element.props.className).toContain('footer')
    expect(element.props.className).not.toContain('bg-black')
  })

  it('renders contact icons and every semantic content zone with CMS newsletter copy', async () => {
    getCachedFooterMock.mockResolvedValue(footerGlobal)
    getCachedSiteSettingsMock.mockResolvedValue(siteSettings)
    adaptFooterMock.mockReturnValue(footerData)

    const { container } = render(await Footer())

    expect(screen.getByRole('contentinfo')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Ecolitea' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Ecolitea' })).toBeNull()
    expect(screen.getByText('Sustainable tea systems.')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Footer' })).toBeTruthy()
    expect(screen.getByText('Shanghai, China')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'sales@example.com' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '+86 21 5555 5555' })).toBeTruthy()
    expect(screen.queryByText('Monday–Friday')).toBeNull()
    expect(screen.queryByText(/WhatsApp/)).toBeNull()
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeTruthy()
    expect(screen.queryByText('LinkedIn')).toBeNull()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeTruthy()
    expect(screen.getByText('© 2026 Ecolitea. All rights reserved.')).toBeTruthy()
    expect(screen.getByText('Tea notes')).toBeTruthy()
    expect(screen.getByText('Product launches and practical insights.')).toBeTruthy()
    expect(screen.getByPlaceholderText('Work email').hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Join the list' }).hasAttribute('disabled')).toBe(true)
    expect(document.querySelector('form')).toBeNull()

    const contact = container.querySelector('[data-footer-content="contact"]')
    expect(contact?.querySelectorAll('svg')).toHaveLength(3)
    expect(contact?.querySelector('.lucide-map-pin')?.getAttribute('aria-hidden')).toBe('true')
    expect(contact?.querySelector('.lucide-phone')?.getAttribute('aria-hidden')).toBe('true')
    expect(contact?.querySelector('.lucide-mail')?.getAttribute('aria-hidden')).toBe('true')

    const contentOrder = Array.from(container.querySelectorAll('[data-footer-content]')).map(
      (element) => element.getAttribute('data-footer-content'),
    )
    expect(contentOrder).toEqual(['brand', 'social', 'navigation', 'newsletter', 'contact'])
    expect(screen.getByRole('link', { name: 'LinkedIn' }).className).toContain('socialLink')
  })

  it('omits the complete newsletter section when the adapter disables it', async () => {
    getCachedFooterMock.mockResolvedValue(footerGlobal)
    getCachedSiteSettingsMock.mockResolvedValue(siteSettings)
    adaptFooterMock.mockReturnValue({ ...footerData, newsletter: null })

    const { container } = render(await Footer())

    expect(container.querySelector('[data-footer-content="newsletter"]')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Tea notes' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Join the list' })).toBeNull()
  })
})

describe('FooterNavigation', () => {
  it('uses one accessible accordion state while retaining all links in the rendered baseline', () => {
    render(<FooterNavigation columns={footerData.columns} />)

    const products = screen.getByRole('button', { name: 'Products' })
    const solutions = screen.getByRole('button', { name: 'Solutions' })
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(products.getAttribute('aria-expanded')).toBe('false')
    expect(products.getAttribute('aria-controls')).toMatch(/-products$/)
    expect(products.className).toContain('accordionTrigger')
    expect(screen.getByRole('link', { name: 'Tea' })).toBeTruthy()

    fireEvent.click(products)
    expect(products.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(solutions)
    expect(products.getAttribute('aria-expanded')).toBe('false')
    expect(solutions.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(solutions)
    expect(solutions.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps links visible in server markup and only enables collapse after hydration', () => {
    const markup = renderToStaticMarkup(<FooterNavigation columns={footerData.columns} />)

    expect(markup).toContain('data-enhanced="false"')
    expect(markup).toContain('href="/tea"')
    expect(markup).not.toContain('hidden=""')

    const { container } = render(<FooterNavigation columns={footerData.columns} />)
    expect(container.querySelector('nav')?.getAttribute('data-enhanced')).toBe('true')
    expect(container.querySelector('[data-open="false"]')).toBeTruthy()
  })

  it('creates unique panel IDs and local aria-controls references for every instance', () => {
    const { container } = render(
      <>
        <FooterNavigation columns={footerData.columns} />
        <FooterNavigation columns={footerData.columns} />
      </>,
    )

    const productsButtons = screen.getAllByRole('button', { name: 'Products' })
    const controls = productsButtons.map((button) => button.getAttribute('aria-controls'))
    expect(new Set(controls).size).toBe(2)
    controls.forEach((id) => {
      expect(id).toBeTruthy()
      expect(container.querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
    })
  })

  it('uses one non-desktop column sequence without a tablet two-column override', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/Footer/index.module.css'), 'utf8')

    expect(css).toContain('min-height: 54px')
    expect(css).toMatch(/\.socialLink\s*\{[^}]*min-height:\s*var\(--website-control-target-min\)/s)
    expect(css).not.toMatch(/\.socialIcon\s*\{[^}]*filter:/s)
    expect(css).toMatch(/\.contactItem\s*\{[^}]*display:\s*grid/s)
    expect(css).toMatch(/\.contactIcon\s*\{[^}]*color:\s*inherit/s)
    expect(css).toMatch(/width < 30rem[\s\S]*\.newsletterControls\s*\{[^}]*grid-template-columns:\s*1fr/s)
    expect(css).toContain('@media (width >= 73.125rem)')
    expect(css).not.toMatch(/48rem[^}]*grid-template-columns:\s*repeat\(2/s)
  })

  it('uses the reference Footer brand frame while preserving the logo aspect ratio', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/Footer/index.module.css'), 'utf8')
    const brandLink = css.match(/\.brandLink\s*\{([^}]*)\}/)?.[1] ?? ''
    const logo = css.match(/\.logo\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(brandLink).toContain('min-height: 2.375rem')
    expect(brandLink).toContain('width: min(100%, 10.5rem)')
    expect(logo).toContain('height: auto')
    expect(logo).toContain('width: 100%')
  })

  it('does not render accordion or desktop headings for empty columns', () => {
    render(
      <FooterNavigation
        columns={[
          footerData.columns[0]!,
          { id: 'empty', label: 'Empty', navItems: [] },
        ]}
      />,
    )

    expect(screen.getByRole('button', { name: 'Products' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Empty' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Empty' })).toBeNull()
  })
})
