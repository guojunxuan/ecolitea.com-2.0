'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { TOCItem } from '@/utilities/blogs/extractTOC'
import styles from './index.module.css'

export const MobileDrawer = ({ items }: { items: TOCItem[] }) => {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const overflowRef = useRef<string | null>(null)
  const titleId = useId()

  const restoreScroll = () => {
    if (overflowRef.current !== null) {
      document.body.style.overflow = overflowRef.current
      overflowRef.current = null
    }
  }

  const closeDrawer = () => {
    dialogRef.current?.close()
  }

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const desktop = window.matchMedia('(min-width: 64rem)')
    const onDesktop = () => {
      if (desktop.matches) dialogRef.current?.close()
    }
    desktop.addEventListener('change', onDesktop)
    return () => {
      desktop.removeEventListener('change', onDesktop)
      restoreScroll()
    }
  }, [])

  const openDrawer = () => {
    const dialog = dialogRef.current
    if (!dialog) return
    overflowRef.current = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    setOpen(true)
    closeRef.current?.focus()
  }

  const onClose = () => {
    restoreScroll()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={styles.mobile}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.mobileTrigger}
        aria-label="Open table of contents"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openDrawer}
      >
        <span aria-hidden="true">☰</span> On this page
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault()
          closeDrawer()
        }}
        onClose={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer()
        }}
      >
        <div className={styles.drawer}>
          <div className={styles.drawerHeader}>
            <h2 id={titleId}>Table of contents</h2>
            <button
              ref={closeRef}
              type="button"
              className={styles.closeButton}
              aria-label="Close table of contents"
              onClick={closeDrawer}
            >
              ×
            </button>
          </div>
          <nav aria-label="Table of contents" className={styles.drawerNav}>
            <ol className={styles.list}>
              {items.map((item) => (
                <li className={item.level === 3 ? styles.nested : undefined} key={item.id}>
                  <a href={`#${item.id}`} onClick={closeDrawer}>
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </dialog>
    </div>
  )
}
