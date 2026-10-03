import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { Search } from '@/search/Component'
import { CardPostData } from '@/components/Card'
import { normalizeSearchQuery } from '@/search/query'
import { publicSearchVisibility } from '@/search/visibility'
import { resolveBlogSearchResults } from '@/search/resolveBlogSearchResults'

import styles from '../pages.module.css'

type Args = {
  searchParams: Promise<{
    q?: string | string[]
  }>
}
export default async function Page({ searchParams: searchParamsPromise }: Args) {
  const { q } = await searchParamsPromise
  const query = normalizeSearchQuery(q)
  const payload = await getPayload({ config: configPromise })
  const publicWhere = publicSearchVisibility(new Date())

  const results = await payload.find({
    collection: 'search',
    depth: 1,
    limit: 12,
    select: {
      title: true,
      slug: true,
      doc: true,
      categories: true,
      meta: true,
      excerpt: true,
      category: true,
      heroImage: true,
      publishedAt: true,
    },
    // pagination: false reduces overhead if you don't need totalDocs
    pagination: false,
    overrideAccess: false,
    where: query
      ? {
          and: [
            publicWhere,
            {
              or: [
                { title: { like: query } },
                { 'meta.description': { like: query } },
                { 'meta.title': { like: query } },
                { excerpt: { like: query } },
                { slug: { like: query } },
              ],
            },
          ],
        }
      : publicWhere,
  })

  const blogResults = await resolveBlogSearchResults(payload, results.docs)
  const postResults = results.docs.filter(
    (result) => result.doc.relationTo === 'posts',
  ) as CardPostData[]

  return (
    <div className={styles.pageSection}>
      <div className={styles.pageHeaderCentered}>
        <h1 className={styles.pageTitle}>Search</h1>

        <div className={styles.searchField}>
          <Search initialQuery={query} />
        </div>
      </div>

      {blogResults.length || postResults.length ? (
        <>
          {blogResults.length > 0 && <CollectionArchive posts={blogResults} relationTo="blogs" />}
          {postResults.length > 0 && <CollectionArchive posts={postResults} />}
        </>
      ) : (
        <div className={styles.pageMessage}>No results found.</div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: `Payload Website Template Search`,
  }
}
