'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React, { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/utilities/useDebounce'
import { useRouter } from 'next/navigation'

import styles from './Component.module.css'

export const Search: React.FC<{ initialQuery: string }> = ({ initialQuery }) => {
  const [value, setValue] = useState(initialQuery)
  const router = useRouter()
  const lastServerQuery = useRef(initialQuery)
  const ownQueries = useRef(new Set<string>())
  const lastRequestedQuery = useRef(initialQuery)
  const syncingExternalQuery = useRef(false)

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    if (initialQuery === lastServerQuery.current) return
    lastServerQuery.current = initialQuery

    if (ownQueries.current.has(initialQuery)) return

    lastRequestedQuery.current = initialQuery
    syncingExternalQuery.current = true
    setValue(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    const syncHistoryQuery = () => {
      const query = new URLSearchParams(window.location.search).get('q') ?? ''
      lastRequestedQuery.current = query
      syncingExternalQuery.current = true
      setValue(query)
    }
    window.addEventListener('popstate', syncHistoryQuery)
    return () => window.removeEventListener('popstate', syncHistoryQuery)
  }, [])

  useEffect(() => {
    if (syncingExternalQuery.current) {
      if (debouncedValue === value) syncingExternalQuery.current = false
      return
    }
    if (debouncedValue !== value || debouncedValue === lastRequestedQuery.current) return

    ownQueries.current.add(debouncedValue)
    lastRequestedQuery.current = debouncedValue
    router.push(`/search${debouncedValue ? `?q=${encodeURIComponent(debouncedValue)}` : ''}`)
  }, [debouncedValue, router, value])

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
            syncingExternalQuery.current = false
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
