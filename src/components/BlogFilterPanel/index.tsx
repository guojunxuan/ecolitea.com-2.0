'use client'

import { useEffect, useId, useRef, useState } from 'react'
import styles from './index.module.css'

export interface BlogFilterState {
  categoryId?: string
  authorIds: string[]
  dateRange?: '7d' | '30d' | '3m' | '1y' | 'custom'
  dateFrom?: string
  dateTo?: string
  sort: 'newest' | 'oldest' | 'title-asc' | 'title-desc'
}
export interface BlogFilterPanelProps {
  categories: { id: string; title: string; slug: string; count: number }[]
  authors: { id: string; name: string }[]
  value: BlogFilterState
  onApply: (value: BlogFilterState) => void
  onReset: () => void
}
const filterSignature = (value: BlogFilterState) =>
  JSON.stringify([
    value.categoryId || '',
    [...new Set(value.authorIds)].sort(),
    value.dateRange || '',
    value.dateRange === 'custom' ? value.dateFrom || '' : '',
    value.dateRange === 'custom' ? value.dateTo || '' : '',
    value.sort,
  ])
const empty: BlogFilterState = { authorIds: [], sort: 'newest' }

export function BlogFilterPanel({
  categories,
  authors,
  value,
  onApply,
  onReset,
}: BlogFilterPanelProps) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const overflow = useRef<string | null>(null)
  const signature = filterSignature(value)
  const [previousSignature, setPreviousSignature] = useState(signature)
  if (previousSignature !== signature) {
    setPreviousSignature(signature)
    setDraft(value)
  }
  const restoreScroll = () => {
    if (overflow.current !== null) {
      document.body.style.overflow = overflow.current
      overflow.current = null
    }
  }
  const close = () => {
    dialog.current?.close()
  }
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)')
    const onDesktop = () => {
      if (desktop.matches) dialog.current?.close()
    }
    desktop.addEventListener('change', onDesktop)
    return () => {
      desktop.removeEventListener('change', onDesktop)
      restoreScroll()
    }
  }, [])
  const dateError =
    draft.dateRange !== 'custom'
      ? undefined
      : !draft.dateFrom && !draft.dateTo
        ? 'Enter a start or end date.'
        : draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo
          ? 'End date must be on or after start date.'
          : undefined
  const count =
    (value.categoryId ? 1 : 0) +
    value.authorIds.length +
    (value.dateRange ? 1 : 0) +
    (value.sort !== 'newest' ? 1 : 0)
  const controls = (surface: string) => (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        if (dateError || !event.currentTarget.reportValidity()) return
        onApply({
          ...draft,
          authorIds: [...draft.authorIds],
          dateFrom: draft.dateRange === 'custom' ? draft.dateFrom : undefined,
          dateTo: draft.dateRange === 'custom' ? draft.dateTo : undefined,
        })
        if (open) close()
      }}
    >
      <fieldset>
        <legend>Category</legend>
        <label>
          <input
            type="radio"
            name={`${id}-${surface}-category`}
            checked={!draft.categoryId}
            onChange={() => setDraft({ ...draft, categoryId: undefined })}
          />
          All categories
        </label>
        {categories.map((category) => (
          <label key={category.id}>
            <input
              type="radio"
              name={`${id}-${surface}-category`}
              checked={draft.categoryId === category.id}
              onChange={() => setDraft({ ...draft, categoryId: category.id })}
            />
            {category.title} ({category.count})
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Authors</legend>
        {authors.length === 0 && <p>No authors available.</p>}
        {authors.map((author) => (
          <label key={author.id}>
            <input
              type="checkbox"
              checked={draft.authorIds.includes(author.id)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  authorIds: event.target.checked
                    ? [...draft.authorIds, author.id]
                    : draft.authorIds.filter((id) => id !== author.id),
                })
              }
            />
            {author.name}
          </label>
        ))}
      </fieldset>
      <label className={styles.selectLabel}>
        Date range
        <select
          value={draft.dateRange ?? ''}
          onChange={(event) =>
            setDraft({
              ...draft,
              dateRange: (event.target.value || undefined) as BlogFilterState['dateRange'],
            })
          }
        >
          <option value="">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="3m">Last 3 months</option>
          <option value="1y">Last year</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      {draft.dateRange === 'custom' && (
        <div className={styles.dates}>
          <label>
            From
            <input
              type="date"
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? `${id}-${surface}-date-error` : undefined}
              value={draft.dateFrom ?? ''}
              max={draft.dateTo || undefined}
              onChange={(event) =>
                setDraft({ ...draft, dateFrom: event.target.value || undefined })
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? `${id}-${surface}-date-error` : undefined}
              value={draft.dateTo ?? ''}
              min={draft.dateFrom || undefined}
              onChange={(event) => setDraft({ ...draft, dateTo: event.target.value || undefined })}
            />
          </label>
        </div>
      )}
      {dateError && (
        <p id={`${id}-${surface}-date-error`} role="status">
          {dateError}
        </p>
      )}
      <label className={styles.selectLabel}>
        Sort by
        <select
          value={draft.sort}
          onChange={(event) =>
            setDraft({ ...draft, sort: event.target.value as BlogFilterState['sort'] })
          }
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title-asc">Title (A–Z)</option>
          <option value="title-desc">Title (Z–A)</option>
        </select>
      </label>
      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => {
            setDraft(empty)
            onReset()
            if (open) close()
          }}
        >
          Reset all
        </button>
        <button type="submit" disabled={Boolean(dateError)}>
          Apply filters
        </button>
      </div>
    </form>
  )
  return (
    <>
      <aside className={styles.desktop} aria-label="Blog filters">
        <h2>Filters{count > 0 ? ` (${count})` : ''}</h2>
        {controls('desktop')}
      </aside>
      <button
        className={styles.mobileTrigger}
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!dialog.current || open) return
          overflow.current = document.body.style.overflow
          dialog.current.showModal()
          document.body.style.overflow = 'hidden'
          setOpen(true)
          closeButton.current?.focus()
        }}
      >
        Filters{count > 0 ? ` (${count})` : ''}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => {
          restoreScroll()
          setOpen(false)
          trigger.current?.focus()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div className={styles.drawer}>
          <div className={styles.header}>
            <h2 id={`${id}-title`}>Filters</h2>
            <button ref={closeButton} type="button" aria-label="Close filters" onClick={close}>
              ×
            </button>
          </div>
          {controls('mobile')}
        </div>
      </dialog>
    </>
  )
}
