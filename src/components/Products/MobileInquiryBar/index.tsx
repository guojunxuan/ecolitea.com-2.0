'use client'
import React, { useEffect, useState } from 'react'
import { CMSLink } from '@/components/Link'
import type { InquiryButton } from '@/utilities/products/models'
import styles from './index.module.css'
export function MobileInquiryBar({
  action,
  targetId = 'inquiry',
}: {
  action?: InquiryButton
  targetId?: string
}) {
  const [visible, setVisible] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target || !action || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0),
    )
    observer.observe(target)
    const footer = document.querySelector('footer')
    const footerObserver = footer
      ? new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting))
      : null
    if (footer) footerObserver?.observe(footer)
    return () => {
      observer.disconnect()
      footerObserver?.disconnect()
    }
  }, [targetId, action])
  if (!action || !visible || footerVisible) return null
  return (
    <div className={styles.root}>
      <CMSLink {...action} appearance={action.appearance ?? 'default'} />
    </div>
  )
}
