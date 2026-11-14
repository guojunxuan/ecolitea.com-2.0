import type { ButtonHTMLAttributes } from 'react'
import styles from './MediaArrow.module.css'

export function MediaArrow({
  direction,
  overlay = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  direction: 'previous' | 'next'
  overlay?: boolean
}) {
  return (
    <button
      {...props}
      type="button"
      data-overlay={overlay || undefined}
      className={[styles.arrow, className].filter(Boolean).join(' ')}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        aria-hidden="true"
        style={{ transform: direction === 'previous' ? 'rotate(180deg)' : undefined }}
      >
        <path
          d="m9 5 7 7-7 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
