'use client'

import { Check, X } from 'lucide-react'
import { Fragment, useEffect, useId, useRef, useState } from 'react'

import { useDictionary } from '@/i18n/DictionaryProvider'
import { Button } from '@/components/ui/button'

import styles from './QuoteRequestDialog.module.css'
import { QuoteRequestForm, type QuoteRequestProduct } from './QuoteRequestForm'

type View = 'closed' | 'form' | 'done'

/**
 * Same native-dialog behaviour as DownloadDialog. The form mounts only while open, so the
 * Turnstile script loads on demand and reopening always starts from a clean form.
 */
export function QuoteRequestDialog({
  product,
  siteKey,
}: {
  product: QuoteRequestProduct
  siteKey: string | undefined
}) {
  const { quote: copy } = useDictionary()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const title = useRef<HTMLHeadingElement>(null)
  const successTitle = useRef<HTMLHeadingElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState<View>('closed')
  const [submittedName, setSubmittedName] = useState('')

  useEffect(() => {
    if (view === 'done') successTitle.current?.focus()
  }, [view])

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
        className={styles.trigger}
        aria-haspopup="dialog"
        onClick={() => {
          setView('form')
          setSubmittedName('')
          document.documentElement.style.overflow = 'hidden'
          dialog.current?.showModal()
          title.current?.focus()
        }}
      >
        {copy.trigger}
      </Button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => {
          setView('closed')
          document.documentElement.style.overflow = ''
          trigger.current?.focus()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        <div className={styles.surface}>
          <header className={styles.header}>
            {view !== 'done' && (
              <div className={styles.intro}>
                <p className={styles.eyebrow}>{copy.eyebrow}</p>
                <h2 ref={title} id={titleId} tabIndex={-1} className={styles.title}>
                  {copy.title}
                </h2>
                <p className={styles.description}>{copy.description}</p>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.close}
              aria-label={copy.close}
              onClick={() => dialog.current?.close()}
            >
              <X strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </header>
          <div className={styles.body}>
            {view === 'form' && (
              <QuoteRequestForm
                product={product}
                siteKey={siteKey}
                onSuccess={(name) => {
                  setSubmittedName(name)
                  setView('done')
                }}
              />
            )}
            {view === 'done' && (
              <div className={styles.done}>
                <div className={styles.successIcon}>
                  <Check strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h2 ref={successTitle} id={titleId} tabIndex={-1} className={styles.title}>
                  {copy.successTitle.replace('{name}', () => submittedName)}
                </h2>
                <p className={styles.confirmation}>
                  {copy.successMessage.split('{product}').map((part, index) => (
                    <Fragment key={index}>
                      {index > 0 && <strong>{product.title}</strong>}
                      {part}
                    </Fragment>
                  ))}
                </p>
                <Button
                  type="button"
                  className={styles.doneClose}
                  onClick={() => dialog.current?.close()}
                >
                  {copy.close}
                </Button>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
