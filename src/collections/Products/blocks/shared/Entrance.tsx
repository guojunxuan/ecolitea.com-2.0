'use client'

import React, { useEffect, useRef } from 'react'
import styles from './Entrance.module.css'

export function Entrance({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (
      !element ||
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset.entered = 'true'
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={[styles.entrance, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
