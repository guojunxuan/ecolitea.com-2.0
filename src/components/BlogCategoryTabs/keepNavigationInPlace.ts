'use client'

import type React from 'react'
import { useLayoutEffect } from 'react'

// Category routes remount the navigation, so the offset survives in module scope until consumed.
let pendingOffset: number | null = null

/** Records where the category navigation sits before a same-tab category navigation. */
export function rememberNavigationOffset(event: React.MouseEvent<HTMLAnchorElement>) {
  const link = event.currentTarget
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.getAttribute('aria-current') === 'page'
  )
    return
  const navigation = link.closest('nav')
  pendingOffset = navigation ? navigation.getBoundingClientRect().top : null
}

/** Puts the new route's category navigation back at the recorded viewport offset. */
export function useRestoreNavigationOffset(
  ref: React.RefObject<HTMLElement | null>,
  currentCategory?: string,
) {
  useLayoutEffect(() => {
    const navigation = ref.current?.closest('nav')
    if (pendingOffset === null || !navigation) return
    const offset = pendingOffset
    pendingOffset = null
    // The navigation's scroll margin carries the fixed-header anchor offset token.
    const minimumOffset = parseFloat(getComputedStyle(navigation).scrollMarginBlockStart) || 0
    if (offset < minimumOffset) {
      navigation.scrollIntoView({ block: 'start', behavior: 'instant' })
      return
    }
    window.scrollBy({ top: navigation.getBoundingClientRect().top - offset, behavior: 'instant' })
  }, [ref, currentCategory])
}
