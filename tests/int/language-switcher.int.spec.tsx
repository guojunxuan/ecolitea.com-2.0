import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageSwitcher } from '@/Header/Nav/LanguageSwitcher'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { preferencesCookie } from '@/i18n/preferences'
import { ConsentProvider } from '@/consent/ConsentProvider'
import { CookieSettingsButton } from '@/consent/CookieSettingsButton'
import { CookieSettingsDialog } from '@/consent/CookieSettingsDialog'
import { DesktopNav } from '@/Header/Nav/DesktopNav'
import { LanguageUnavailableNotice } from '@/i18n/LanguageUnavailableNotice'
import { assertPhase3I18nFixtureEnvironment } from '@/i18n/testFixtureGuard'

const fixture = vi.hoisted(() => ({
  locales: [
    { code: 'en', label: 'English', status: 'source' },
    { code: 'de', label: 'Deutsch', status: 'live' },
  ],
  regions: [
    { code: 'GLOBAL', label: 'Global', locale: 'en', group: null },
    { code: 'DE', label: 'Deutschland', locale: 'de', group: 'Europe' },
    { code: 'AT', label: 'Österreich', locale: 'de', group: 'Europe' },
    { code: 'FR', label: 'France', locale: 'fr', group: 'Europe' },
  ],
}))
vi.mock('@/i18n/config', () => ({
  sourceLocale: 'en',
  isLocaleSegment: (segment: string) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment),
  locales: fixture.locales,
  publicLocales: fixture.locales,
  regions: fixture.regions,
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

beforeEach(() => {
  document.cookie = 'ec_preferences=; Max-Age=0; Path=/'
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
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

describe('Header language switcher', () => {
  it('groups only public regions and defaults the checkmark to the current language', () => {
    render(
      <LocaleProvider locale="de">
        <LanguageSwitcher mode="desktop" />
      </LocaleProvider>,
    )
    fireEvent.click(trigger())
    expect(screen.getByRole('heading', { name: 'Europe' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /France/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Deutschland/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: /Österreich/ }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('reads the selected region only when opened and refreshes after preference clearing', () => {
    document.cookie = 'ec_preferences=AT; Path=/'
    render(<LanguageSwitcher mode="desktop" />)
    fireEvent.click(trigger())
    expect(screen.getByRole('button', { name: /Österreich/ }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(trigger())
    document.cookie = 'ec_preferences=; Max-Age=0; Path=/'
    fireEvent.click(trigger())
    expect(screen.getByRole('button', { name: /Global/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('supports Escape, outside click, keyboard focus and trigger toggling', () => {
    render(<LanguageSwitcher mode="desktop" />)
    trigger().focus()
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: /Global/ })).toBe(document.activeElement)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger()).toBe(document.activeElement)
    fireEvent.click(trigger())
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(trigger())
    fireEvent.click(trigger())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the language panel and mega menu mutually exclusive', () => {
    render(
      <DesktopNav
        menuCta={null}
        navItems={[
          {
            id: 'products',
            label: 'Products',
            navigationType: 'dropdown',
            link: null,
            content: [{ id: 'links', type: 'linkGroup', heading: 'Products', links: [] }],
          },
        ]}
      />,
    )
    const products = screen.getByRole('button', { name: 'Products' })
    fireEvent.click(products)
    expect(products.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(trigger())
    expect(products.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(products)
    expect(screen.queryByRole('dialog', { name: 'Region & language' })).toBeNull()
  })

  it('closes the language panel when Cookie settings opens and closes settings when language opens', () => {
    render(
      <ConsentProvider gtmDisabled={true}>
        <LanguageSwitcher mode="desktop" />
        <CookieSettingsButton />
        <CookieSettingsDialog />
      </ConsentProvider>,
    )
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
    expect(screen.queryByRole('dialog', { name: 'Region & language' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeTruthy()
    fireEvent.click(trigger())
    expect(screen.queryByRole('dialog', { name: 'Cookie settings' })).toBeNull()
  })

  it('uses a full-screen modal on mobile and restores focus on close', () => {
    render(<LanguageSwitcher mode="mobile" />)
    fireEvent.click(trigger())
    const dialog = screen.getByRole('dialog', { name: 'Region & language' })
    expect(dialog.tagName).toBe('DIALOG')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger()).toBe(document.activeElement)
  })

  it('always renders the entry, even in a single-language configuration', () => {
    const german = fixture.locales.pop()!
    try {
      render(<LanguageSwitcher mode="desktop" />)
      expect(trigger()).toBeTruthy()
    } finally {
      fixture.locales.push(german)
    }
  })

  it('persists the region and leaves a useful error when switching fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<LanguageSwitcher mode="desktop" />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', { name: /Deutschland/ }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Unable to switch language. Please try again.',
    )
    expect(document.cookie).toContain('ec_preferences=DE')
  })

  it('shows the missing-language notice only on the target homepage', () => {
    history.replaceState({}, '', '/de?unavailable=de')
    try {
      render(
        <LocaleProvider locale="de">
          <LanguageUnavailableNotice />
        </LocaleProvider>,
      )
      expect(screen.getByRole('status').textContent).toBe(
        'This page is not available in Deutsch yet.',
      )
    } finally {
      history.replaceState({}, '', '/')
    }
  })

  it('requires isolated local test settings before injecting browser fixture languages', () => {
    expect(assertPhase3I18nFixtureEnvironment({})).toBe(false)
    const env = {
      PHASE3_I18N_FIXTURE: 'true',
      PLAYWRIGHT_TEST: 'true',
      DISABLE_R2_STORAGE: 'true',
      DATABASE_URI: 'mongodb://127.0.0.1:27017/ecolitea2-test-phase3',
    }
    expect(assertPhase3I18nFixtureEnvironment(env)).toBe(true)
    for (const changes of [
      { PLAYWRIGHT_TEST: 'false' },
      { DISABLE_R2_STORAGE: 'false' },
      { DATABASE_URI: 'mongodb://127.0.0.1:27017/ecolitea2' },
      { DATABASE_URI: 'mongodb://remote.example.invalid/ecolitea2-test-phase3' },
    ]) {
      expect(() => assertPhase3I18nFixtureEnvironment({ ...env, ...changes })).toThrow(
        /fixtures require/i,
      )
    }
  })

  it('writes a twelve-month host-only preference cookie with HTTPS security', () => {
    expect(preferencesCookie('DE', 'https:')).toBe(
      'ec_preferences=DE; Path=/; SameSite=Lax; Max-Age=31536000; Secure',
    )
    expect(preferencesCookie('GLOBAL', 'http:')).not.toContain('Secure')
    expect(preferencesCookie('DE', 'https:')).not.toContain('Domain')
  })
})
