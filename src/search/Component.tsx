'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React, { useState, useEffect } from 'react'
import { useDebounce } from '@/utilities/useDebounce'
import { useRouter } from 'next/navigation'

import styles from './Component.module.css'

export const Search: React.FC<{ initialQuery: string }> = ({ initialQuery }) => {
  const [value, setValue] = useState(initialQuery)
  const router = useRouter()

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    if (debouncedValue !== initialQuery) {
      router.push(`/search${debouncedValue ? `?q=${encodeURIComponent(debouncedValue)}` : ''}`)
    }
  }, [debouncedValue, initialQuery, router])

  return (
    <div>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Label htmlFor="search" className={styles.visuallyHidden}>
          Search
        </Label>
        <Input
          id="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          placeholder="Search"
        />
        <button type="submit" className={styles.visuallyHidden}>
          submit
        </button>
      </form>
    </div>
  )
}
