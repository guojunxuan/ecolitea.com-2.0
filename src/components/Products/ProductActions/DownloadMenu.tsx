'use client'

import { ChevronDown, Download } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import styles from './index.module.css'

export type DownloadMenuFile = { id: string; title: string; url: string; meta?: string }

export function DownloadMenu({ files }: { files: DownloadMenuFile[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={root}
      className={styles.menu}
      onBlur={(event) => {
        // Close when keyboard focus leaves the trigger and panel.
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        className={styles.download}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Download
        <ChevronDown aria-hidden="true" className={styles.chevron} />
      </Button>
      <div
        id={panelId}
        className={styles.panel}
        data-open={open || undefined}
        inert={!open}
        aria-hidden={!open || undefined}
      >
        <ul className={styles.files} aria-label="Downloads">
          {files.map((file) => (
            <li key={file.id}>
              <a className={styles.file} href={file.url} target="_blank" rel="noopener noreferrer">
                <span className={styles.fileTitle}>{file.title}</span>
                {file.meta && <span className={styles.metadata}>{file.meta}</span>}
                <Download aria-hidden="true" className={styles.fileIcon} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
