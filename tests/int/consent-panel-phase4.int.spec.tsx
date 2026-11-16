import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsentProvider } from '@/consent/ConsentProvider'
import { CookieSettingsDialog } from '@/consent/CookieSettingsDialog'
import { CookieSettingsButton } from '@/consent/CookieSettingsButton'
import { DictionaryProvider } from '@/i18n/DictionaryProvider'
import en from '@/i18n/dictionaries/en.json'

const observers: ResizeObserverCallback[] = []
beforeEach(() => {
  observers.length = 0
  vi.stubEnv('NEXT_PUBLIC_GTM_MEASUREMENT_ID', '')
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  for (const cookie of document.cookie.split(';'))
    document.cookie = `${cookie.split('=')[0].trim()}=; Path=/; Max-Age=0`
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const mount = () => {
  render(
    <DictionaryProvider dictionary={en}>
      <ConsentProvider gtmDisabled>
        <CookieSettingsButton />
        <CookieSettingsDialog />
      </ConsentProvider>
    </DictionaryProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }))
  return screen.getByRole('dialog', { name: 'Cookie settings' })
}

describe('Phase 4 cookie settings', () => {
  it('starts with closed category explanations and exposes linked disclosure controls', () => {
    const panel = mount()
    for (const category of ['Necessary', 'Analytics', 'Marketing']) {
      const toggle = within(panel).getByRole('button', { name: `${category} details` })
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      const description = document.getElementById(toggle.getAttribute('aria-controls')!)!
      expect(description.hidden).toBe(true)
      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(description.hidden).toBe(false)
      fireEvent.click(toggle)
      expect(description.hidden).toBe(true)
    }
    expect(document.cookie).not.toContain('ec_consent=')
  })

  it('places preference clearing inside Necessary and preserves optional switches', () => {
    document.cookie = 'ec_preferences=DE; Path=/'
    const panel = mount()
    expect(within(panel).queryByRole('button', { name: 'Clear' })).toBeNull()
    fireEvent.click(within(panel).getByRole('button', { name: 'Necessary details' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Clear' }))
    expect(document.cookie).not.toContain('ec_preferences=')
    fireEvent.click(within(panel).getByRole('switch', { name: 'Analytics' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Save settings' }))
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":true,"marketing":false')
  })

  it('only offers Read more when the two-line introduction actually overflows', () => {
    const panel = mount()
    expect(within(panel).queryByRole('button', { name: 'Read more' })).toBeNull()
    const description = within(panel).getByText(en.consent.settingsDescription)
    Object.defineProperties(description, {
      scrollHeight: { configurable: true, value: 80 },
      clientHeight: { configurable: true, value: 40 },
    })
    act(() => {
      for (const callback of observers) callback([], {} as ResizeObserver)
    })
    const expand = within(panel).getByRole('button', { name: 'Read more' })
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    expect(expand.getAttribute('aria-controls')).toBe(description.id)
    fireEvent.click(expand)
    expect(
      within(panel).getByRole('button', { name: 'Read less' }).getAttribute('aria-expanded'),
    ).toBe('true')
  })
})

it('makes the full mobile banner description reachable through Read more', async () => {
  const { CookieBanner } = await import('@/consent/CookieBanner')
  vi.stubGlobal('innerWidth', 390)
  render(
    <ConsentProvider gtmDisabled>
      <CookieBanner />
    </ConsentProvider>,
  )
  const text = screen.getByText(en.consent.description)
  Object.defineProperty(text, 'scrollHeight', { configurable: true, value: 90 })
  Object.defineProperty(text, 'clientHeight', { configurable: true, value: 48 })
  act(() => observers.forEach((observer) => observer([], {} as ResizeObserver)))
  const toggle = screen.getByRole('button', { name: 'Read more' })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(toggle.getAttribute('aria-controls')).toBe(text.id)
  fireEvent.click(toggle)
  expect(screen.getByRole('button', { name: 'Read less' }).getAttribute('aria-expanded')).toBe(
    'true',
  )
  expect(text.getAttribute('data-expanded')).toBe('true')
  expect(text.textContent).toBe(en.consent.description)
})
