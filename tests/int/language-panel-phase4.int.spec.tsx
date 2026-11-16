import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageSwitcher } from '@/Header/Nav/LanguageSwitcher'
import { MobileNav } from '@/Header/Nav/MobileNav'
import { announcePanelOpen } from '@/utilities/panelEvents'

const fixture = vi.hoisted(() => ({
  locale: 'en',
  i18n: {
    publicLocales: [
      { code: 'en', label: 'English', short: 'EN', googleCode: 'en' },
      { code: 'de', label: 'Deutsch', short: 'DE', googleCode: 'de' },
    ],
    targetLocales: [],
    regions: [
      { code: 'GLOBAL', label: 'Global', locale: 'en', group: null },
      { code: 'DE', label: 'Deutschland', locale: 'de', group: 'Europe' },
      { code: 'FR', label: 'France', locale: 'fr', group: 'Europe' },
    ],
  },
}))
vi.mock('@/i18n/LocaleProvider', () => ({
  useLocale: () => fixture.locale,
  useLocaleContext: () => ({
    locale: fixture.locale,
    i18n: fixture.i18n,
    legalPaths: [],
    englishLabel: '(English)',
  }),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

beforeEach(() => {
  document.cookie = 'ec_preferences=; Max-Age=0; Path=/'
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  vi.stubGlobal('scrollTo', vi.fn())
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const trigger = () => screen.getByRole('button', { name: 'Region & language' })
const panel = () => screen.getByRole('dialog', { name: 'Region & language' })

describe('Phase 4 language panel', () => {
  it('uses the short language entry and a native modal with grouped public regions', () => {
    render(<LanguageSwitcher />)
    expect(trigger().textContent).toBe('EN')
    fireEvent.click(trigger())
    expect(panel().tagName).toBe('DIALOG')
    expect(panel()).toHaveProperty('open', true)
    expect(within(panel()).getByRole('heading', { name: 'Location & language' })).toBeTruthy()
    expect(within(panel()).getByRole('heading', { name: 'Europe' })).toBeTruthy()
    expect(
      within(within(panel()).getByRole('button', { name: /Deutschland · Deutsch/ })).getByText(
        'DE',
      ),
    ).toBeTruthy()
    expect(within(panel()).queryByRole('button', { name: /France/ })).toBeNull()
    expect(
      within(panel())
        .getByRole('button', { name: /Global · English/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('closes on Escape, backdrop and another panel, restoring the triggering focus', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(trigger())
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger())
    fireEvent.click(trigger())
    fireEvent.click(panel())
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(trigger())
    act(() => announcePanelOpen('cookie-settings'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the language view inside the mobile menu without closing it', () => {
    render(<MobileNav menuCta={null} navItems={[]} siteName="Ecolitea" />)
    expect(screen.queryByRole('button', { name: 'Region & language' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const entry = screen.getByRole('button', { name: /Global EN/ })
    fireEvent.click(entry)
    // The menu stays open; the language view slides in over it.
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Region & language' })).toBeNull()
    const view = document.getElementById('mobile-language-view')!
    expect(view.getAttribute('data-open')).toBe('true')
    expect(view.hasAttribute('inert')).toBe(false)
    expect(entry.getAttribute('aria-expanded')).toBe('true')
    expect(within(view).getByRole('heading', { name: 'Location & language' })).toBeTruthy()
    expect(within(view).getByRole('button', { name: /Global · English/ })).toBeTruthy()
    fireEvent.click(within(view).getByRole('button', { name: 'Back to menu' }))
    expect(view.getAttribute('data-open')).toBe('false')
    expect(view.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(entry)
  })

  it('keeps the Global EN entry when no additional languages are public', () => {
    const german = fixture.i18n.publicLocales.pop()!
    try {
      render(<LanguageSwitcher />)
      fireEvent.click(trigger())
      expect(within(panel()).getAllByRole('button', { name: /Global · English/ })).toHaveLength(1)
      expect(within(panel()).queryByRole('button', { name: /Deutschland/ })).toBeNull()
    } finally {
      fixture.i18n.publicLocales.push(german)
    }
  })

  it('persists selection and reports transport failures without losing the panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<LanguageSwitcher />)
    fireEvent.click(trigger())
    fireEvent.click(within(panel()).getByRole('button', { name: /Deutschland · Deutsch/ }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Unable to switch language. Please try again.',
    )
    expect(document.cookie).toContain('ec_preferences=DE')
  })
})
