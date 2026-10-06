'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import type { BlogListItem } from '@/utilities/blogs/getBlogListing'
import styles from './index.module.css'
import { useRouter } from 'next/navigation'
import {
  BlogFilterPanel,
  type BlogFilterState,
  type BlogFilterPanelProps,
} from '@/components/BlogFilterPanel'
import { Pagination } from '@/components/Pagination'
import {
  blogFilterHref,
  blogFilterRequest,
  readBlogFilterQuery,
  hasBlogQueryFilters,
} from '@/utilities/blogs/filterURL'

type Props = {
  initialBlogs: BlogListItem[]
  initialPage: number
  totalPages: number
  totalDocs: number
  categoryId?: string
  featuredFirst?: boolean
  categories?: BlogFilterPanelProps['categories']
  authors?: BlogFilterPanelProps['authors']
  routeBase?: string
  initialQuery?: string
}

/** A new server snapshot owns a new request lifetime and initial card list. */
export function BlogExplorer(props: Props) {
  const query = props.initialQuery ?? ''
  const filters = readBlogFilterQuery(query, props.categoryId)
  const [snapshot, setSnapshot] = useState({ blogs: props.initialBlogs, revision: 0 })
  // A refreshed RSC snapshot can edit the same IDs without changing pagination.
  // Reset the child before committing, so old cards and requests never own it.
  if (snapshot.blogs !== props.initialBlogs) {
    setSnapshot({ blogs: props.initialBlogs, revision: snapshot.revision + 1 })
  }
  const snapshotKey = JSON.stringify([
    query,
    snapshot.revision,
    props.categoryId ?? null,
    props.initialPage,
    props.totalDocs,
    props.initialBlogs.map(({ id }) => id),
  ])
  return <Explorer key={snapshotKey} {...props} filters={filters} />
}

function Explorer({
  initialBlogs,
  initialPage,
  totalPages,
  totalDocs,
  featuredFirst,
  categories,
  authors,
  routeBase,
  filters,
}: Props & { filters: BlogFilterState }) {
  const router = useRouter()
  const filtered = hasBlogQueryFilters(filters)
  const [blogs, setBlogs] = useState(initialBlogs)
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(totalDocs)
  const [hasMore, setHasMore] = useState(initialPage < totalPages)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const request = useRef<AbortController | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      request.current?.abort()
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!mounted.current || request.current || !hasMore) return
    const controller = new AbortController()
    request.current = controller
    setStatus('loading')
    const params = blogFilterRequest(filters, page + 1)
    try {
      const response = await fetch(`/api/public-blog-list?${params}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Blog list request failed')
      const result = (await response.json()) as {
        docs: BlogListItem[]
        page: number
        totalDocs: number
        hasNextPage: boolean
      }
      if (!Array.isArray(result.docs) || result.page !== page + 1)
        throw new Error('Invalid blog page')
      if (!mounted.current || controller.signal.aborted) return
      setBlogs((current) => {
        const ids = new Set(current.map(({ id }) => id))
        return [
          ...current,
          ...result.docs.filter(({ id }) => {
            if (ids.has(id)) return false
            ids.add(id)
            return true
          }),
        ]
      })
      setPage(result.page)
      setTotal(result.totalDocs)
      setHasMore(result.hasNextPage)
      setStatus('idle')
    } catch {
      if (mounted.current && !controller.signal.aborted) setStatus('error')
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [filters, hasMore, page])

  useEffect(() => {
    if (
      !hasMore ||
      status !== 'idle' ||
      !sentinel.current ||
      typeof IntersectionObserver === 'undefined'
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore, status])

  return (
    <div className={categories ? styles.layout : undefined}>
      {categories && (
        <BlogFilterPanel
          categories={categories.filter((item) => item.count > 0)}
          authors={authors ?? []}
          value={filters}
          onApply={(value) => router.push(blogFilterHref(value, categories))}
          onReset={() => router.push('/blogs')}
        />
      )}
      <div className={categories ? styles.results : undefined}>
        {page > 0 && (
          <PageRange
            className={styles.range}
            collection="blogs"
            currentPage={initialPage}
            limit={12}
            totalDocs={total}
            loadedCount={blogs.length}
          />
        )}
        <CollectionArchive
          posts={blogs}
          relationTo="blogs"
          featuredFirst={featuredFirst && !filtered}
          embedded={Boolean(categories)}
        />
        <div className={styles.controls}>
          <div ref={sentinel} aria-hidden="true" />
          <p role="status" aria-live="polite" aria-atomic="true">
            {status === 'loading'
              ? page === 0
                ? 'Loading blogs…'
                : 'Loading more blogs…'
              : status === 'error'
                ? page === 0
                  ? 'Failed to load blogs.'
                  : 'Failed to load more blogs.'
                : blogs.length === 0
                  ? 'No blogs found.'
                  : !hasMore
                    ? "You've reached the end."
                    : ''}
          </p>
          {hasMore && (
            <button type="button" disabled={status === 'loading'} onClick={() => void loadMore()}>
              {status === 'error' ? 'Try again' : status === 'loading' ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
        {!filtered && routeBase && totalPages > 1 && (
          <Pagination
            linkMode
            page={initialPage}
            totalPages={totalPages}
            routeBase={routeBase}
            firstPageHref={routeBase}
          />
        )}
      </div>
    </div>
  )
}
