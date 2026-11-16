'use client'

import { Check, X } from 'lucide-react'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { GlobeIcon } from '@/components/icons/GlobeIcon'
import { useDictionary } from '@/i18n/DictionaryProvider'
import { useLocaleContext } from '@/i18n/LocaleProvider'
import { readRegionPreference, writeRegionPreference } from '@/i18n/preferences'
import { announcePanelOpen, listenForPanelOpen } from '@/utilities/panelEvents'
import styles from './LanguageSwitcher.module.css'

export function LanguageSwitcher({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const {
    locale,
    i18n: { publicLocales, regions },
  } = useLocaleContext()
  const { language: copy } = useDictionary()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const id = useId()
  const titleId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const entries = regions.filter((region) =>
    publicLocales.some(({ code }) => code === region.locale),
  )
  const selectedRegion =
    entries.find(({ code }) => code === selected)?.code ??
    entries.find((entry) => entry.locale === locale)?.code
  const current = publicLocales.find(({ code }) => code === locale)

  const close = useCallback((restoreFocus = true) => {
    // Release native modal inertness before returning focus to the visible Header entry.
    dialog.current?.close()
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }, [])
  const show = useCallback(() => {
    announcePanelOpen(id)
    setSelected(readRegionPreference())
    setOpen(true)
  }, [id])

  useEffect(() => {
    onOpenChange?.(open)
  }, [onOpenChange, open])
  useEffect(
    () =>
      listenForPanelOpen((owner) => {
        if (owner !== id) close(false)
      }),
    [close, id],
  )
  useEffect(() => {
    if (!open) return
    const element = dialog.current!
    const overflow = document.documentElement.style.overflow
    element.showModal()
    document.documentElement.style.overflow = 'hidden'
    element.querySelector<HTMLButtonElement>('[data-region]')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (
        !element.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close()
    }
    const onResize = () => close(false)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onResize)
      element.close()
      document.documentElement.style.overflow = overflow
    }
  }, [close, open])

  return (
    <div className={styles.root}>
      {
        <button
          aria-controls={id}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={copy.trigger}
          className={styles.trigger}
          onClick={() => (open ? close() : show())}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              show()
            }
          }}
          ref={trigger}
          type="button"
        >
          <GlobeIcon aria-hidden="true" />
          <span>{current?.short ?? locale.toUpperCase()}</span>
        </button>
      }
      {open && (
        <dialog
          aria-label={copy.trigger}
          className={styles.panel}
          data-website-theme="default"
          id={id}
          onCancel={(event) => {
            event.preventDefault()
            close()
          }}
          onClose={(event) => {
            if (!event.currentTarget.open) close()
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
          ref={dialog}
        >
          <div className={styles.surface}>
            <div className={styles.heading}>
              <h2 className="website-type-title" id={titleId}>
                {copy.title}
              </h2>
              <Button aria-label={copy.close} onClick={() => close()} size="icon" variant="ghost">
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className={styles.body}>
              <RegionList selectedRegion={selectedRegion} onSelect={setSelected} />
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

/** Region list shared by the desktop dialog and the mobile menu's language view. */
export function RegionList({
  selectedRegion,
  onSelect,
}: {
  selectedRegion?: string
  onSelect?: (code: string) => void
}) {
  const {
    i18n: { publicLocales, regions },
  } = useLocaleContext()
  const { language: copy } = useDictionary()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const entries = regions.filter((region) =>
    publicLocales.some(({ code }) => code === region.locale),
  )
  const groups = [...new Set(entries.map(({ group }) => group))]
  const setSelected = (code: string) => onSelect?.(code)

  const select = async (region: (typeof regions)[number]) => {
    setBusy(true)
    setError(false)
    writeRegionPreference(region.code)
    setSelected(region.code)
    try {
      const query = new URLSearchParams({ path: location.pathname, locale: region.locale })
      const response = await fetch(`/next/language-target?${query}`)
      if (!response.ok) throw new Error('Language target unavailable')
      const result: unknown = await response.json()
      const href = result && typeof result === 'object' && 'href' in result ? result.href : null
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//'))
        throw new Error('Invalid language target')
      const target = new URL(href, location.origin)
      if (!target.searchParams.has('unavailable')) {
        new URLSearchParams(location.search).forEach((value, key) =>
          target.searchParams.append(key, value),
        )
        target.hash = location.hash
      }
      // A language change replaces the root layout and its html lang, with no stale client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign(`${target.pathname}${target.search}${target.hash}`)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <>
      <div className={styles.groups}>
        {groups.map((group) => (
          <section key={group ?? 'global'}>
            {group && <h3 className="website-type-eyebrow">{group}</h3>}
            <div className={styles.entries}>
              {entries
                .filter((region) => region.group === group)
                .map((region) => (
                  <button
                    aria-label={`${region.label} · ${publicLocales.find(({ code }) => code === region.locale)?.label ?? region.locale}`}
                    aria-pressed={selectedRegion === region.code}
                    className={styles.region}
                    data-region={region.code}
                    disabled={busy}
                    key={region.code}
                    onClick={() => void select(region)}
                    type="button"
                  >
                    <span>{region.label}</span>
                    <span className={styles.selection}>
                      <span className={styles.short}>
                        {publicLocales.find(({ code }) => code === region.locale)?.short}
                      </span>
                      {selectedRegion === region.code && <Check aria-hidden="true" size={18} />}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
      {error && (
        <p className="website-type-body-sm" role="alert">
          {copy.error}
        </p>
      )}
    </>
  )
}
