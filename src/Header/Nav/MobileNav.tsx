'use client'

import { ArrowLeft, ChevronRight, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { Logo } from '@/components/Logo/Logo'
import type { LogoImage } from '@/components/Logo/types'
import RichText from '@/components/RichText'

import styles from './index.module.css'
import { initialNavigationState, navigationReducer } from './navigationState'
import type { HeaderDropdownItemData, HeaderLinkData, HeaderNavigationData } from './types'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let bodyScrollLockCount = 0
let bodyOverflowBeforeLock: string | null = null

const acquireBodyScrollLock = () => {
  if (bodyScrollLockCount === 0) bodyOverflowBeforeLock = document.body.style.overflow
  bodyScrollLockCount += 1
  document.body.style.overflow = 'hidden'

  let released = false
  return () => {
    if (released) return
    released = true
    bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
    if (bodyScrollLockCount !== 0) return
    document.body.style.overflow = bodyOverflowBeforeLock ?? ''
    bodyOverflowBeforeLock = null
  }
}

const getFocusableElements = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.closest('[inert]'),
  )

const NavigationLink: React.FC<{
  className?: string
  link: HeaderLinkData
  onActivate: () => void
  visibleLabel?: string
}> = ({ className, link, onActivate, visibleLabel }) => (
  <Link
    className={className}
    href={link.href}
    onClick={onActivate}
    {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
  >
    {visibleLabel ?? link.label}
  </Link>
)

const GroupedItem: React.FC<{
  item: Extract<HeaderDropdownItemData, { type: 'featured' | 'list' }>
  onActivate: () => void
}> = ({ item, onActivate }) => {
  const content = item.type === 'featured' ? item.featuredItem : item.listItem

  return (
    <div className={styles.mobileGroupedContent}>
      <NavigationLink
        className={styles.mobileViewAll}
        link={content.landingLink}
        onActivate={onActivate}
      />
      {item.type === 'featured' && item.featuredItem.label ? (
        <RichText
          className={styles.mobileFeaturedCopy}
          data={item.featuredItem.label}
          enableGutter={false}
        />
      ) : null}
      <div className={styles.mobileLinkList}>
        {content.links.map(({ id, link }) => (
          <NavigationLink key={id} link={link} onActivate={onActivate} />
        ))}
      </div>
    </div>
  )
}

type MobileNavProps = HeaderNavigationData & {
  logo?: LogoImage | null
}

export const MobileNav: React.FC<MobileNavProps> = ({ logo, menuCta, navItems }) => {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [state, dispatch] = useReducer(navigationReducer, initialNavigationState)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const levelTwoTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const levelThreeTriggerRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const pendingBackFocusRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<Array<HTMLElement | null>>([])

  const close = useCallback((restoreFocus = true) => {
    if (restoreFocus) openButtonRef.current?.focus()
    setIsOpen(false)
    dispatch({ type: 'reset' })
  }, [])

  const open = () => {
    setIsOpen(true)
  }

  const openDropdown = (navItemIndex: number, trigger: HTMLButtonElement) => {
    levelTwoTriggerRefs.current[navItemIndex] = trigger
    dispatch({ navItemIndex, type: 'openDropdown' })
  }

  const openItem = (itemIndex: number, trigger: HTMLButtonElement) => {
    levelThreeTriggerRefs.current[itemIndex] = trigger
    dispatch({ itemIndex, type: 'openItem' })
  }

  const back = () => {
    const focusTarget =
      state.level === 3 && state.activeItemIndex !== null
        ? levelThreeTriggerRefs.current[state.activeItemIndex]
        : state.activeNavItemIndex !== null
          ? levelTwoTriggerRefs.current[state.activeNavItemIndex]
          : null
    pendingBackFocusRef.current = focusTarget ?? null
    dispatch({ type: 'back' })
  }

  useEffect(() => {
    if (!isOpen) return
    const pendingFocus = pendingBackFocusRef.current
    pendingBackFocusRef.current = null
    if (pendingFocus) {
      pendingFocus.focus()
      return
    }
    const activePanel = panelRefs.current[state.level - 1]
    if (activePanel) getFocusableElements(activePanel).at(0)?.focus()
  }, [isOpen, state.level])

  useEffect(() => {
    close(false)
  }, [close, pathname])

  useEffect(() => {
    if (!isOpen) return
    return acquireBodyScrollLock()
  }, [isOpen])

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 73.125rem)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) close(false)
    }
    onChange(media)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [close])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = getFocusableElements(dialogRef.current)
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
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, isOpen])

  const activeNavItem =
    state.activeNavItemIndex === null ? null : navItems[state.activeNavItemIndex]
  const activeDropdown = activeNavItem?.dropdown ?? null
  const activeDropdownItem =
    state.activeItemIndex === null ? null : activeDropdown?.items[state.activeItemIndex]
  const groupedItem =
    activeDropdownItem?.type === 'featured' || activeDropdownItem?.type === 'list'
      ? activeDropdownItem
      : null

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
          data-level={state.level}
          ref={dialogRef}
          role="dialog"
        >
          <div className={styles.mobileNavHeader}>
            {logo ? (
              <Link
                aria-label={logo.alt}
                className={styles.mobileLogoLink}
                href="/"
                onClick={() => close()}
              >
                <Logo className={styles.mobileLogo} image={logo} loading="eager" priority="high" />
              </Link>
            ) : (
              <span className={styles.mobileNavTitle}>Menu</span>
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

          <div
            className={styles.mobileNavTrack}
            style={{ '--mobile-navigation-level': state.level - 1 } as React.CSSProperties}
          >
            <section
              aria-hidden={state.level !== 1}
              className={styles.mobileNavPanel}
              data-testid="mobile-navigation-panel"
              inert={state.level !== 1}
              ref={(node) => {
                panelRefs.current[0] = node
              }}
            >
              <h2>Navigation</h2>
              <nav aria-label="Primary navigation" className={styles.mobileLinkList}>
                {navItems.map((item, index) =>
                  item.navigationType === 'directLink' && item.link ? (
                    <NavigationLink key={item.id} link={item.link} onActivate={() => close()} />
                  ) : item.dropdown ? (
                    <button
                      aria-label={`Open ${item.label}`}
                      className={styles.mobileDrillButton}
                      key={item.id}
                      onClick={(event) => openDropdown(index, event.currentTarget)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  ) : null,
                )}
              </nav>
              {menuCta ? (
                <NavigationLink
                  className={styles.mobileMenuCta}
                  link={menuCta}
                  onActivate={() => close()}
                />
              ) : null}
            </section>

            <section
              aria-hidden={state.level !== 2}
              className={styles.mobileNavPanel}
              data-testid="mobile-navigation-panel"
              inert={state.level !== 2}
              ref={(node) => {
                panelRefs.current[1] = node
              }}
            >
              <button className={styles.mobileBackButton} onClick={back} type="button">
                <ArrowLeft aria-hidden="true" /> Back to Navigation
              </button>
              <h2>{activeNavItem?.label ?? 'Menu'}</h2>
              {activeDropdown ? (
                <div>
                  {activeDropdown.description ? (
                    <p className={styles.mobileDescription}>{activeDropdown.description}</p>
                  ) : null}
                  <div className={styles.mobileLinkList}>
                    {activeNavItem?.navigationType === 'directLinkAndDropdown' &&
                    activeNavItem.link ? (
                      <NavigationLink
                        link={activeNavItem.link}
                        onActivate={() => close()}
                        visibleLabel="Overview"
                      />
                    ) : null}
                    {activeDropdown.descriptionLinks.map(({ id, link }) => (
                      <NavigationLink key={id} link={link} onActivate={() => close()} />
                    ))}
                    {activeDropdown.items.map((item, index) =>
                      item.type === 'default' ? (
                        <div className={styles.mobileDefaultItem} key={item.id}>
                          <NavigationLink link={item.defaultItem.link} onActivate={() => close()} />
                          {item.defaultItem.description ? (
                            <p>{item.defaultItem.description}</p>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          aria-label={`Open ${
                            item.type === 'featured' ? item.featuredItem.tag : item.listItem.tag
                          }`}
                          className={styles.mobileDrillButton}
                          key={item.id}
                          onClick={(event) => openItem(index, event.currentTarget)}
                          type="button"
                        >
                          <span>
                            {item.type === 'featured' ? item.featuredItem.tag : item.listItem.tag}
                          </span>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section
              aria-hidden={state.level !== 3}
              className={styles.mobileNavPanel}
              data-testid="mobile-navigation-panel"
              inert={state.level !== 3}
              ref={(node) => {
                panelRefs.current[2] = node
              }}
            >
              <button className={styles.mobileBackButton} onClick={back} type="button">
                <ArrowLeft aria-hidden="true" /> Back to {activeNavItem?.label ?? 'Menu'}
              </button>
              <h2>
                {groupedItem?.type === 'featured'
                  ? groupedItem.featuredItem.tag
                  : groupedItem?.type === 'list'
                    ? groupedItem.listItem.tag
                    : 'Menu'}
              </h2>
              {groupedItem ? <GroupedItem item={groupedItem} onActivate={() => close()} /> : null}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
