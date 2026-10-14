'use client'

import { useEffect, useRef, useState } from 'react'
import { Link } from 'lucide-react'
import styles from './index.module.css'

export const CopyLink = ({ url }: { url: string }) => {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    let feedback = 'Link copied'
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      feedback = 'Copy failed'
    }
    if (!mounted.current) return
    if (timer.current !== null) clearTimeout(timer.current)
    setMessage(feedback)
    timer.current = setTimeout(() => setMessage(''), 2000)
  }

  return (
    <div className={styles.copy}>
      <button aria-label="Copy link" className={styles.control} onClick={copy} type="button">
        <Link aria-hidden="true" size={20} />
      </button>
      <span className={styles.status} role="status" aria-live="polite">
        {message}
      </span>
    </div>
  )
}
