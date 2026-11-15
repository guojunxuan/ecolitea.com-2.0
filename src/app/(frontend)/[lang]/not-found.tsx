import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'

import styles from './pages.module.css'

export default function NotFound() {
  return (
    <div className={styles.notFound}>
      <div>
        <h1 className={styles.pageTitle}>404</h1>
        <p>This page could not be found.</p>
      </div>
      <Button asChild variant="default">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  )
}
