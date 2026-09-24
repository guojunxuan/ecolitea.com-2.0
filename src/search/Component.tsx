'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React, { useState, useEffect, useRef } from 'react'
import { useDebounce } from '@/utilities/useDebounce'
import { useRouter, useSearchParams } from 'next/navigation'

import styles from './Component.module.css'

export const Search: React.FC<{ initialQuery: string }> = ({ initialQuery }) => {
  const [value, setValue] = useState(initialQuery)
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const lastUrlQuery = useRef(initialQuery)
  const pendingQueries = useRef<string[]>([])
  const lastRequestedQuery = useRef(initialQuery)
  const syncingExternalQuery = useRef(false)

  const debouncedValue = useDebounce(value)

  useEffect(() => {
    if (urlQuery === lastUrlQuery.current) return
    lastUrlQuery.current = urlQuery

    const pendingIndex = pendingQueries.current.indexOf(urlQuery)
    if (pendingIndex >= 0) {
      pendingQueries.current = pendingQueries.current.slice(pendingIndex + 1)
      return
    }

    pendingQueries.current = []
    lastRequestedQuery.current = urlQuery
    syncingExternalQuery.current = true
    setValue(urlQuery)
  }, [urlQuery])

  useEffect(() => {
    const syncHistoryQuery = () => {
      const query = new URLSearchParams(window.location.search).get('q') ?? ''
      pendingQueries.current = []
      lastUrlQuery.current = query
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

    pendingQueries.current.push(debouncedValue)
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
