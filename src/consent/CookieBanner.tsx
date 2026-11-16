'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { useConsent } from './ConsentProvider'
import { useDictionary } from '@/i18n/DictionaryProvider'
import { ConsentDescription } from './ConsentDescription'
import styles from './CookieBanner.module.css'

export function CookieBanner({ cookiePolicyHref }: { cookiePolicyHref?: string | null }) {
  const { consent: copy } = useDictionary()
  const consent = useConsent()
  const banner = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!consent.bannerVisible || !banner.current) return
    const element = banner.current
    const previous = document.body.style.paddingBottom
    const baseline = parseFloat(getComputedStyle(document.body).paddingBottom) || 0
    const measure = () => {
      document.body.style.paddingBottom = `${Math.ceil(baseline + element.getBoundingClientRect().height)}px`
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => {
      observer.disconnect()
      document.body.style.paddingBottom = previous
    }
  }, [consent.bannerVisible])

  if (!consent.bannerVisible) return null
  return (
    <section
      ref={banner}
      className={styles.banner}
      data-website-theme="default"
      role="region"
      aria-label={copy.region}
    >
      <div className={`site-container ${styles.content}`}>
        <div className={styles.intro}>
          <h2 className="website-type-title">{copy.title}</h2>
          <ConsentDescription
            text={copy.description}
            descriptionClassName={styles.description}
            buttonClassName={styles.readMore}
          />
          {cookiePolicyHref && (
            <Link className={`website-type-body-sm ${styles.policy}`} href={cookiePolicyHref}>
              {copy.policy}
            </Link>
          )}
        </div>
        <div className={styles.actions}>
          <Button type="button" onClick={consent.acceptAll}>
            {copy.accept}
          </Button>
          <Button type="button" onClick={consent.rejectOptional}>
            {copy.reject}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={styles.settings}
            aria-haspopup="dialog"
            onClick={(event) => consent.openSettings(event.currentTarget)}
          >
            {copy.settings}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={styles.close}
        aria-label={copy.close}
        onClick={consent.dismissBanner}
      >
        <X aria-hidden="true" />
      </Button>
    </section>
  )
}
