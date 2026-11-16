'use client'

import { Minus, Plus, X } from 'lucide-react'
import React, { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useConsent } from './ConsentProvider'
import { clearPreferences, readCookie } from './cookie'
import { useDictionary } from '@/i18n/DictionaryProvider'
import { ConsentDescription } from './ConsentDescription'
import styles from './CookieSettingsDialog.module.css'

export function CookieSettingsDialog() {
  const { settingsOpen } = useConsent()
  return settingsOpen ? <SettingsPanel /> : null
}

function Category({
  name,
  control,
  children,
  descriptionId,
}: {
  name: string
  control: React.ReactNode
  children: React.ReactNode
  descriptionId: string
}) {
  const { consent: copy } = useDictionary()
  const [expanded, setExpanded] = useState(false)
  return (
    <section className={styles.category}>
      <div className={styles.row}>
        <h3 className="website-type-button">{name}</h3>
        {control}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${name} ${copy.details}`}
          aria-expanded={expanded}
          aria-controls={descriptionId}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
        </Button>
      </div>
      <div id={descriptionId} className={styles.explanation} hidden={!expanded}>
        {children}
      </div>
    </section>
  )
}

function SettingsPanel() {
  const { consent: copy } = useDictionary()
  const { state, gpc, save, rejectOptional, closeSettings } = useConsent()
  const [analytics, setAnalytics] = useState(state?.analytics ?? false)
  const [marketing, setMarketing] = useState(state?.marketing ?? false)
  const [hasPreferences, setHasPreferences] = useState(() => readCookie('ec_preferences') !== null)
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const necessaryId = useId()
  const analyticsId = useId()
  const marketingId = useId()

  useEffect(() => {
    const element = dialog.current!
    const previousOverflow = document.documentElement.style.overflow
    element.showModal()
    document.documentElement.style.overflow = 'hidden'
    title.current?.focus()
    return () => {
      element.close()
      document.documentElement.style.overflow = previousOverflow
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      data-website-theme="default"
      aria-labelledby={titleId}
      onClose={(event) => {
        // Strict Mode may reopen the dialog before a queued native close event arrives.
        if (!event.currentTarget.open) closeSettings()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className={styles.surface}>
        <header className={styles.header}>
          <h2 ref={title} id={titleId} tabIndex={-1} className="website-type-heading-3">
            {copy.settings}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={copy.close}
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className={styles.body}>
          <ConsentDescription
            text={copy.settingsDescription}
            descriptionClassName={styles.description}
            containerClassName={styles.introduction}
            buttonClassName={styles.readMore}
          />
          <div className={styles.categories}>
            <Category
              name={copy.necessary}
              descriptionId={necessaryId}
              control={
                <span className={`website-type-caption ${styles.badge}`}>{copy.alwaysActive}</span>
              }
            >
              <p className="website-type-body-sm">{copy.necessaryDescription}</p>
              {hasPreferences && (
                <div className={styles.preference}>
                  <span className="website-type-body-sm">{copy.preferences}</span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      clearPreferences()
                      setHasPreferences(false)
                    }}
                  >
                    {copy.clear}
                  </Button>
                </div>
              )}
            </Category>
            <Category
              name={copy.analytics}
              descriptionId={analyticsId}
              control={
                <button
                  type="button"
                  className={styles.switch}
                  role="switch"
                  aria-label={copy.analytics}
                  aria-describedby={analyticsId}
                  aria-checked={analytics}
                  onClick={() => setAnalytics(!analytics)}
                >
                  <span aria-hidden="true" />
                </button>
              }
            >
              <p className="website-type-body-sm">{copy.analyticsDescription}</p>
            </Category>
            <Category
              name={copy.marketing}
              descriptionId={marketingId}
              control={
                <button
                  type="button"
                  className={styles.switch}
                  role="switch"
                  aria-label={copy.marketing}
                  aria-describedby={marketingId}
                  aria-checked={gpc ? false : marketing}
                  disabled={gpc}
                  onClick={() => setMarketing(!marketing)}
                >
                  <span aria-hidden="true" />
                </button>
              }
            >
              <p className="website-type-body-sm">{gpc ? copy.gpc : copy.marketingDescription}</p>
            </Category>
          </div>
        </div>
        <footer className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              dialog.current?.close()
              rejectOptional()
            }}
          >
            {copy.reject}
          </Button>
          <Button
            type="button"
            onClick={() => {
              // Release the native modal's inert background before restoring trigger focus.
              dialog.current?.close()
              save({ analytics, marketing })
            }}
          >
            {copy.save}
          </Button>
        </footer>
      </div>
    </dialog>
  )
}
