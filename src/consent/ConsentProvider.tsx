'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

import { readConsent, writeConsent } from './cookie'
import { applyGpc, detectGpc } from './gpc'
import { applyConsent, ensureConsentDefaults, getGtmId } from './gtm'
import type { ConsentState } from './types'
import { announcePanelOpen, listenForPanelOpen } from '@/utilities/panelEvents'

type ConsentContextValue = {
  state: ConsentState | null
  gpc: boolean
  bannerDismissed: boolean
  bannerVisible: boolean
  settingsOpen: boolean
  acceptAll: () => void
  rejectOptional: () => void
  save: (state: Pick<ConsentState, 'analytics' | 'marketing'>) => void
  openSettings: (returnFocusEl?: HTMLElement) => void
  closeSettings: () => void
  dismissBanner: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({
  children,
  gtmDisabled,
}: {
  children: React.ReactNode
  gtmDisabled: boolean
}) {
  const [state, setState] = useState<ConsentState | null>(null)
  const [gpc, setGpc] = useState(false)
  const [ready, setReady] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    ensureConsentDefaults()
    const signal = detectGpc()
    const saved = applyGpc(readConsent(), signal)
    // Cookie and browser signals must hydrate after mount to match the server HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGpc(signal)
    setState(saved)
    setReady(true)
    applyConsent(saved, getGtmId(), gtmDisabled)
  }, [gtmDisabled])

  useEffect(
    () =>
      listenForPanelOpen((owner) => {
        if (owner !== 'cookie-settings') setSettingsOpen(false)
      }),
    [],
  )

  const closeSettings = () => {
    setSettingsOpen(false)
    returnFocus.current?.focus()
  }

  const save: ConsentContextValue['save'] = (flags) => {
    const effective = applyGpc({ ...flags, decidedAt: new Date().toISOString() }, detectGpc())!
    writeConsent(effective)
    setState(effective)
    setGpc(detectGpc())
    applyConsent(effective, getGtmId(), gtmDisabled)
    closeSettings()
  }

  return (
    <ConsentContext.Provider
      value={{
        state,
        gpc,
        bannerDismissed,
        bannerVisible: ready && !state && !bannerDismissed,
        settingsOpen,
        save,
        acceptAll: () => save({ analytics: true, marketing: true }),
        rejectOptional: () => save({ analytics: false, marketing: false }),
        dismissBanner: () => setBannerDismissed(true),
        openSettings: (element) => {
          announcePanelOpen('cookie-settings')
          returnFocus.current =
            element ??
            (document.activeElement instanceof HTMLElement ? document.activeElement : null)
          setSettingsOpen(true)
        },
        closeSettings,
      }}
    >
      {children}
    </ConsentContext.Provider>
  )
}

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext)
  if (!value) throw new Error('Consent components require ConsentProvider.')
  return value
}
