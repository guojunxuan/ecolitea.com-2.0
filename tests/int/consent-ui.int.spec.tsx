import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsentProvider } from '@/consent/ConsentProvider'
import { CookieBanner } from '@/consent/CookieBanner'
import { CookieSettingsDialog } from '@/consent/CookieSettingsDialog'
import { CookieSettingsButton } from '@/consent/CookieSettingsButton'

let resize: ResizeObserverCallback
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GTM_MEASUREMENT_ID', '')
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height: 120,
  } as DOMRect)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
  for (const cookie of document.cookie.split(';'))
    document.cookie = `${cookie.split('=')[0].trim()}=; Path=/; Max-Age=0`
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const mount = (href?: string | null) =>
  render(
    <ConsentProvider gtmDisabled={false}>
      <CookieBanner cookiePolicyHref={href} />
      <CookieSettingsDialog />
      <CookieSettingsButton />
    </ConsentProvider>,
  )
const open = () =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Cookie settings' }).at(-1)!)

describe('consent UI', () => {
  it('renders accessible banner actions, policy link, and measured page clearance', () => {
    document.body.style.paddingBottom = '8px'
    mount('/cookies')
    const banner = screen.getByRole('region', { name: 'Cookie consent' })
    expect(
      within(banner).getByRole('link', { name: 'Cookie Policy (English)' }).getAttribute('href'),
    ).toBe('/cookies')
    expect(within(banner).getByRole('button', { name: 'Accept all' }).className).toBe(
      within(banner).getByRole('button', { name: 'Reject optional' }).className,
    )
    act(() => resize([], {} as ResizeObserver))
    expect(document.body.style.paddingBottom).toBe('128px')
    fireEvent.click(within(banner).getByRole('button', { name: 'Close' }))
    expect(document.body.style.paddingBottom).toBe('8px')
    expect(document.cookie).not.toContain('ec_consent=')
    document.body.style.paddingBottom = ''
  })
  it.each(['Accept all', 'Reject optional'])('persists the %s banner action', (name) => {
    mount()
    expect(screen.queryByRole('link')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.queryByRole('region')).toBeNull()
    expect(decodeURIComponent(document.cookie)).toContain(`"analytics":${name === 'Accept all'}`)
  })
  it('opens from the banner and rejects optional categories from the panel', () => {
    mount()
    fireEvent.click(
      within(screen.getByRole('region')).getByRole('button', { name: 'Cookie settings' }),
    )
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject optional' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":false,"marketing":false')
  })
  it('discards edits on close, returns focus, and saves independent switches', () => {
    mount()
    open()
    fireEvent.click(screen.getByRole('switch', { name: 'Analytics' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(document.cookie).not.toContain('ec_consent=')
    expect(document.activeElement).toBe(
      screen.getAllByRole('button', { name: 'Cookie settings' }).at(-1),
    )
    open()
    expect(screen.getByRole('switch', { name: 'Analytics' }).getAttribute('aria-checked')).toBe(
      'false',
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Analytics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(decodeURIComponent(document.cookie)).toContain('"analytics":true,"marketing":false')
    open()
    expect(screen.getByRole('switch', { name: 'Analytics' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })
  it('locks marketing for GPC and clears existing region preferences', () => {
    document.cookie = 'ec_preferences=DE; Path=/'
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true })
    mount()
    open()
    expect(screen.getByRole('switch', { name: 'Marketing' }).hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByText('Disabled by your browser’s Global Privacy Control setting.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(document.cookie).not.toContain('ec_preferences=')
    expect(screen.queryByText('Region & language preference')).toBeNull()
  })
})
