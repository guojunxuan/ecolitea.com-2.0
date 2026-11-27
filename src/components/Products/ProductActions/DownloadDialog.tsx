'use client'

import { Download, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { trackEvent } from '@/consent/analytics'

import styles from './DownloadDialog.module.css'

export type DownloadDialogFile = { id: string; title: string; url: string; meta?: string }

/**
 * Standalone modal listing the product's resource files. The native dialog supplies the
 * backdrop, focus containment, Esc handling and focus return; entry and exit are CSS-only.
 */
export function DownloadDialog({
  files,
  productSlug,
}: {
  files: DownloadDialogFile[]
  productSlug: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const title = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  // The page behind a modal must not scroll; release the lock if unmounted while open.
  useEffect(
    () => () => {
      document.documentElement.style.overflow = ''
    },
    [],
  )

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => {
          document.documentElement.style.overflow = 'hidden'
          dialog.current?.showModal()
          // Start at the heading so a pointer-opened dialog shows no focus ring on Close.
          title.current?.focus()
        }}
      >
        <Download strokeWidth={1.5} aria-hidden="true" />
        Download
      </Button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => {
          document.documentElement.style.overflow = ''
          // Safari does not focus buttons on click, so native focus return can miss the trigger.
          trigger.current?.focus()
        }}
        onClick={(event) => {
          // Only the backdrop (the dialog element itself) dismisses; clicks inside do not.
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        <div className={styles.surface}>
          <header className={styles.header}>
            <h2 ref={title} id={titleId} tabIndex={-1} className={styles.title}>
              Resources
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
            >
              <X strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </header>
          <ul className={styles.files}>
            {files.map((file) => (
              <li key={file.id}>
                <a
                  className={styles.file}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent('file_download', {
                      file_name: file.url.split(/[?#]/, 1)[0].split('/').at(-1) || file.title,
                      product_slug: productSlug,
                    })
                  }
                >
                  <span className={styles.fileText}>
                    <span className={styles.fileTitle}>{file.title}</span>
                    {file.meta && <span className={styles.metadata}>{file.meta}</span>}
                  </span>
                  <Download strokeWidth={1.5} aria-hidden="true" className={styles.fileIcon} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  )
}
