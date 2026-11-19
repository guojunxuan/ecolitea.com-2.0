'use client'

import React, { useEffect, useRef } from 'react'
import styles from './Entrance.module.css'

export function Entrance({
  as: Element = 'div',
  children,
  className,
  blockType,
}: {
  as?: 'div' | 'header'
  children: React.ReactNode
  className?: string
  blockType?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const entered = useRef(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return

    const section = element.closest('section')
    const sequence = Array.from(
      section?.querySelectorAll<HTMLElement>('[data-product-entrance]') ?? [],
    )
    element.style.setProperty(
      '--product-entrance-order',
      String(Math.min(3, Math.max(0, sequence.indexOf(element)))),
    )

    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | undefined
    const stopObserving = () => {
      observer?.disconnect()
      observer = undefined
    }
    const complete = () => {
      entered.current = true
      element.dataset.entered = 'true'
      element.dataset.entranceState = 'complete'
      stopObserving()
    }
    const play = () => {
      if (entered.current) return
      entered.current = true
      element.dataset.entered = 'true'
      element.dataset.entranceState = 'playing'
      stopObserving()
    }
    const onAnimationEnd = (event: Event) => {
      if (event.target === element) complete()
    }
    const onPreferenceChange = () => {
      if (preference?.matches) complete()
    }

    element.addEventListener('animationend', onAnimationEnd)
    element.addEventListener('animationcancel', onAnimationEnd)
    preference?.addEventListener('change', onPreferenceChange)
    if (preference?.matches || typeof IntersectionObserver === 'undefined') complete()
    else if (!entered.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) play()
        },
        { threshold: 0 },
      )
      observer.observe(element)
      if (document.documentElement.dataset.motion !== 'ready') {
        document.documentElement.dataset.motion = 'ready'
      }
    }
    return () => {
      stopObserving()
      element.removeEventListener('animationend', onAnimationEnd)
      element.removeEventListener('animationcancel', onAnimationEnd)
      preference?.removeEventListener('change', onPreferenceChange)
    }
  }, [])
  return (
    <Element
      ref={(element) => {
        ref.current = element
      }}
      data-product-block={blockType}
      data-product-entrance={Element === 'header' ? 'header' : 'block'}
      className={[styles.entrance, className].filter(Boolean).join(' ')}
    >
      {children}
    </Element>
  )
}
