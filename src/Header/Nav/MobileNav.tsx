'use client'

import { ArrowRight, ChevronRight, SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'

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

type MobileNavProps = HeaderNavigationData & {
  logo?: LogoImage | null
  onOpenChange?: (open: boolean) => void
  siteName?: string
}

export const MobileNav: React.FC<MobileNavProps> = ({
  logo,
  menuCta,
  navItems,
  onOpenChange,
  siteName,
}) => {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [state, dispatch] = useReducer(navigationReducer, initialNavigationState)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const rootPanelRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const desktopFocusHandoffRef = useRef(false)
  const restoreFocusRef = useRef(false)

  useEffect(() => {
    onOpenChange?.(isOpen)
  }, [isOpen, onOpenChange])

  const close = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus
    if (rootPanelRef.current) rootPanelRef.current.scrollTop = 0
    setIsOpen(false)
    dispatch({ type: 'reset' })
  }, [])

  useEffect(() => {
    if (isOpen) return
    if (desktopFocusHandoffRef.current) {
      desktopFocusHandoffRef.current = false
      const desktopNavigation = document.querySelector<HTMLElement>(
        '[data-desktop-nav-root="true"]',
      )
      if (desktopNavigation) getFocusable(desktopNavigation).at(0)?.focus()
      return
    }
    if (!restoreFocusRef.current) return
    restoreFocusRef.current = false
    openButtonRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    return acquireBodyScrollLock()
  }, [isOpen])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return
    const changed = new Map<Element, boolean>()
    let child: Element = dialog
    let parent = child.parentElement
    while (parent) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === child) continue
        changed.set(sibling, sibling.hasAttribute('inert'))
        sibling.setAttribute('inert', '')
      }
      if (parent === document.body) break
      child = parent
      parent = parent.parentElement
    }
    return () => {
      changed.forEach((wasInert, element) => {
        if (!wasInert) element.removeAttribute('inert')
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const media = window.matchMedia?.('(width > 1170px)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        desktopFocusHandoffRef.current = true
        close(false)
      }
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
        close()
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
      if (!dialogRef.current?.contains(event.target as Node)) {
        event.preventDefault()
        close()
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current
      if (!dialog || dialog.contains(event.target as Node)) return
      getFocusable(dialog).at(0)?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [close, isOpen])

  const activeItem = navItems.find((item) => item.id === state.activeSectionId) ?? null

  useEffect(() => {
    if (!isOpen || !state.activeSectionId || activeItem) return
    // Live Payload updates can remove an expanded item while navigation stays open.
    dispatch({ type: 'reset' })
  }, [activeItem, isOpen, state.activeSectionId])

  const brand = logo ? (
    <Logo className={styles.mobileLogo} image={logo} loading="eager" priority="high" />
  ) : (
    <span className={styles.mobileNavTitle}>{siteName || 'Menu'}</span>
  )

  return (
    <div
      {...(isOpen ? { 'aria-label': 'Navigation', 'aria-modal': true, role: 'dialog' } : {})}
      className={styles.mobileNav}
      ref={dialogRef}
    >
      <div className={styles.mobileToolbar} data-open={isOpen ? 'true' : 'false'}>
        <button
          aria-controls="mobile-navigation-root"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
          className={styles.mobileMenuButton}
          onClick={() => (isOpen ? close() : setIsOpen(true))}
          ref={openButtonRef}
          type="button"
        >
          <span aria-hidden="true" className={styles.mobileMenuLine} />
          <span aria-hidden="true" className={styles.mobileMenuLine} />
          <span aria-hidden="true" className={styles.mobileMenuLine} />
        </button>
        <Link
          aria-label={logo?.alt || siteName || 'Home'}
          className={styles.mobileLogoLink}
          href="/"
          onClick={() => close(false)}
        >
          {brand}
        </Link>
        <Link
          aria-label="Search"
          className={styles.mobileIconButton}
          href="/search"
          onClick={() => close(false)}
        >
          <SearchIcon aria-hidden="true" />
        </Link>
      </div>

      {isOpen ? (
        <div className={styles.mobileNavDialog}>
          <section
            className={styles.mobileNavPanel}
            data-testid="mobile-navigation-root"
            id="mobile-navigation-root"
            ref={rootPanelRef}
          >
            <nav aria-label="Primary navigation" className={styles.mobileLinkList}>
              {navItems.map((item) => {
                if (item.navigationType === 'directLink') {
                  return (
                    <Link
                      className={styles.mobileDirectLink}
                      href={item.link.href}
                      key={item.id}
                      onClick={() => close()}
                      {...(item.link.newTab
                        ? { rel: 'noopener noreferrer', target: '_blank' }
                        : {})}
                    >
                      <span>{item.label}</span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  )
                }

                const expanded = state.activeSectionId === item.id
                const panelID = `mobile-navigation-section-${item.id}`
                const compactAccordion = Object.fromEntries(
                  item.content
                    .filter((block) => block.type === 'categoryTabs')
                    .map((block) => [block.id, state.sectionAccordion[block.id] ?? null]),
                )

                return (
                  <div
                    className={styles.mobileAccordionItem}
                    data-expanded={expanded ? 'true' : 'false'}
                    key={item.id}
                  >
                    <button
                      aria-controls={panelID}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Close' : 'Open'} ${item.label}`}
                      className={styles.mobileAccordionTrigger}
                      onClick={() => dispatch({ type: 'toggleSection', sectionId: item.id })}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                    <div
                      aria-hidden={expanded ? undefined : 'true'}
                      className={styles.mobileAccordionPanel}
                      id={panelID}
                      inert={expanded ? undefined : true}
                    >
                      <div className={styles.mobileAccordionInner}>
                        <div className={styles.mobileAccordionContent}>
                          <NavigationBlocks
                            blocks={item.content}
                            compactAccordion={compactAccordion}
                            mode="compact"
                            onCompactAccordionChange={(blockId, categoryId) =>
                              dispatch({ type: 'setSectionAccordion', blockId, categoryId })
                            }
                          />
                          {item.navigationType === 'directLinkAndDropdown' ? (
                            <Link
                              className={styles.mobileViewAll}
                              href={item.link.href}
                              onClick={() => close()}
                              {...(item.link.newTab
                                ? { rel: 'noopener noreferrer', target: '_blank' }
                                : {})}
                            >
                              <span>{`View all ${item.label}`}</span>
                              <ArrowRight aria-hidden="true" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </nav>
          </section>
          {menuCta ? (
            <div className={styles.mobileMenuCtaBar} data-mobile-cta-bar="true">
              <Link
                className={styles.mobileMenuCta}
                href={menuCta.href}
                onClick={() => close()}
                {...(menuCta.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
              >
                {menuCta.label}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
