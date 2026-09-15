'use client'

import { ArrowLeft, ChevronRight, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { Logo } from '@/components/Logo/Logo'
import type { LogoImage } from '@/components/Logo/types'

import { NavigationBlocks } from './NavigationBlocks'
import styles from './index.module.css'
import { initialNavigationState, navigationReducer } from './navigationState'
import type { HeaderNavigationData } from './types'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let bodyScrollLockCount = 0
let bodyOverflowBeforeLock: string | null = null
let bodyScrollYBeforeLock = 0

const acquireBodyScrollLock = () => {
  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow
    bodyScrollYBeforeLock = window.scrollY
  }
  bodyScrollLockCount += 1
  document.body.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
    if (bodyScrollLockCount === 0) {
      document.body.style.overflow = bodyOverflowBeforeLock ?? ''
      bodyOverflowBeforeLock = null
      window.scrollTo?.(0, bodyScrollYBeforeLock)
      bodyScrollYBeforeLock = 0
    }
  }
}

const getFocusable = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest('[inert]'),
  )

type MobileNavProps = HeaderNavigationData & { logo?: LogoImage | null; siteName?: string }

export const MobileNav: React.FC<MobileNavProps> = ({ logo, menuCta, navItems, siteName }) => {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [state, dispatch] = useReducer(navigationReducer, initialNavigationState)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const rootPanelRef = useRef<HTMLElement>(null)
  const sectionPanelRef = useRef<HTMLElement>(null)
  const sectionTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const pendingFocusRef = useRef<HTMLElement | null>(null)
  const sectionBackButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const close = useCallback((restoreFocus = true) => {
    if (restoreFocus) openButtonRef.current?.focus()
    setIsOpen(false)
    dispatch({ type: 'reset' })
  }, [])

  const open = () => setIsOpen(true)

  const backToRoot = useCallback(() => {
    const sectionId = state.activeSectionId
    if (!sectionId) return
    const panel = sectionPanelRef.current
    dispatch({ type: 'backToRoot', sectionId, scrollTop: panel?.scrollTop ?? 0 })
    pendingFocusRef.current = sectionTriggerRefs.current[sectionId]
  }, [state.activeSectionId])

  const openSection = (id: string, trigger: HTMLButtonElement) => {
    sectionTriggerRefs.current[id] = trigger
    dispatch({ type: 'openSection', sectionId: id })
  }

  // Scroll maps are read only when entering a view; adding them as dependencies
  // would refocus the view on every scroll event.
  useEffect(() => {
    if (!isOpen) return
    const pending = pendingFocusRef.current
    pendingFocusRef.current = null
    if (pending?.isConnected) {
      pending.focus()
      return
    }
    if (pending && rootPanelRef.current) {
      rootPanelRef.current
        .querySelector<HTMLElement>(`[data-nav-section-id="${pending.dataset.navSectionId}"]`)
        ?.focus()
      return
    }
    if (state.activeSectionId) {
      sectionBackButtonRef.current?.focus()
      return
    }
    const activePanel = state.activeSectionId ? sectionPanelRef.current : rootPanelRef.current
    if (!activePanel) return
    const savedTop = state.activeSectionId
      ? (state.sectionScrollTop[state.activeSectionId] ?? 0)
      : state.rootScrollTop
    activePanel.scrollTop = savedTop
    getFocusable(activePanel).at(0)?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, state.activeSectionId])

  useEffect(() => {
    if (!isOpen) return
    return acquireBodyScrollLock()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const media = window.matchMedia?.('(width > 1170px)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) close(false)
    }
    onChange(media)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [close, isOpen])

  useEffect(() => {
    // Route transitions dismiss the menu without moving focus to the old trigger.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    close(false)
  }, [close, pathname])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (state.activeSectionId) backToRoot()
        else close()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = getFocusable(dialogRef.current)
      const first = focusable.at(0)
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [backToRoot, close, isOpen, state.activeSectionId])

  const activeItem = navItems.find((item) => item.id === state.activeSectionId) ?? null

  return (
    <div className={styles.mobileNav}>
      <button
        aria-expanded={isOpen}
        aria-label="Open navigation"
        className={styles.mobileMenuButton}
        onClick={open}
        ref={openButtonRef}
        type="button"
      >
        <Menu aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          aria-label="Navigation"
          aria-modal="true"
          className={styles.mobileNavDialog}
          ref={dialogRef}
          role="dialog"
        >
          <div className={styles.mobileNavHeader}>
            {state.activeSectionId ? (
              <button
                aria-label="Back to navigation"
                className={styles.mobileBackButton}
                onClick={backToRoot}
                ref={sectionBackButtonRef}
                type="button"
              >
                <ArrowLeft aria-hidden="true" />
              </button>
            ) : (
              <span className={styles.mobileNavHeaderSpacer} aria-hidden="true" />
            )}
            {state.activeSectionId ? (
              <h2 className={styles.mobileNavTitle}>{activeItem?.label ?? 'Menu'}</h2>
            ) : logo ? (
              <Link
                aria-label={logo.alt}
                className={styles.mobileLogoLink}
                href="/"
                onClick={() => close()}
              >
                <Logo className={styles.mobileLogo} image={logo} loading="eager" priority="high" />
              </Link>
            ) : (
              <Link className={styles.mobileNavTitle} href="/" onClick={() => close()}>
                {siteName || 'Menu'}
              </Link>
            )}
            <button
              aria-label="Close navigation"
              className={styles.mobileIconButton}
              onClick={() => close()}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          {!state.activeSectionId ? (
            <section
              className={styles.mobileNavPanel}
              data-testid="mobile-navigation-root"
              ref={rootPanelRef}
              onScroll={(event) =>
                dispatch({ type: 'setRootScrollTop', scrollTop: event.currentTarget.scrollTop })
              }
            >
              <nav aria-label="Primary navigation" className={styles.mobileLinkList}>
                {navItems.map((item) => {
                  if (item.navigationType === 'directLink' && item.link) {
                    return (
                      <Link
                        key={item.id}
                        href={item.link.href}
                        onClick={() => close()}
                        {...(item.link.newTab
                          ? { rel: 'noopener noreferrer', target: '_blank' }
                          : {})}
                      >
                        {item.label}
                      </Link>
                    )
                  }
                  if (!item.content?.length) return null
                  if (item.navigationType === 'dropdown') {
                    return (
                      <button
                        aria-label={`Open ${item.label}`}
                        className={styles.mobileDrillButton}
                        data-nav-section-id={item.id}
                        key={item.id}
                        onClick={(event) => openSection(item.id, event.currentTarget)}
                        type="button"
                      >
                        <span>{item.label}</span>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    )
                  }
                  return (
                    <div className={styles.mobileHybridRow} key={item.id}>
                      <Link
                        href={item.link.href}
                        onClick={() => close()}
                        {...(item.link.newTab
                          ? { rel: 'noopener noreferrer', target: '_blank' }
                          : {})}
                      >
                        {item.label}
                      </Link>
                      <button
                        aria-label={`Open ${item.label}`}
                        className={styles.mobileDrillButton}
                        data-nav-section-id={item.id}
                        onClick={(event) => openSection(item.id, event.currentTarget)}
                        type="button"
                      >
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
              </nav>
              {menuCta ? (
                <Link
                  className={styles.mobileMenuCta}
                  href={menuCta.href}
                  onClick={() => close()}
                  {...(menuCta.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                >
                  {menuCta.label}
                </Link>
              ) : null}
            </section>
          ) : (
            <section
              className={styles.mobileNavPanel}
              data-testid="mobile-navigation-section"
              ref={sectionPanelRef}
              onScroll={(event) =>
                dispatch({
                  type: 'setSectionScrollTop',
                  sectionId: state.activeSectionId!,
                  scrollTop: event.currentTarget.scrollTop,
                })
              }
            >
              {activeItem?.content ? (
                <NavigationBlocks
                  blocks={activeItem.content}
                  mode="compact"
                  compactAccordion={state.sectionAccordion}
                  onCompactAccordionChange={(blockId, categoryId) =>
                    dispatch({ type: 'setSectionAccordion', blockId, categoryId })
                  }
                />
              ) : null}
            </section>
          )}
        </div>
      ) : null}
    </div>
  )
}
