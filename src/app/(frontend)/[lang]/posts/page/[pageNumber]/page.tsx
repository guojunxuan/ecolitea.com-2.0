import { localizeMetadata } from '@/utilities/i18n/seo'
import { getLocalizedList } from '@/utilities/i18n/getLocalized'
import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { notFound } from 'next/navigation'

import styles from '../../../pages.module.css'

export const revalidate = 600

type Args = {
  params: Promise<{ lang: string; pageNumber: string }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber, lang = 'en' } = await paramsPromise
  const payload = await getPayload({ config: configPromise })

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber)) notFound()

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page: sanitizedPageNumber,
    overrideAccess: false,
  })

  return (
    <div className={styles.pageSection}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Posts</h1>
      </div>

      <div className={styles.pageRange}>
        <PageRange
          collection="posts"
          currentPage={posts.page}
          limit={12}
          totalDocs={posts.totalDocs}
        />
      </div>

      <CollectionArchive posts={await getLocalizedList(posts.docs, 'posts', lang, payload)} />

      <div className={styles.paginationContainer}>
        {posts?.page && posts?.totalPages > 1 && (
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber, lang = 'en' } = await paramsPromise
  return localizeMetadata(
    {
      title: `Payload Website Template Posts Page ${pageNumber || ''}`,
    },
    { path: `/posts/page/${pageNumber}`, locale: lang },
  )
}

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const { totalDocs } = await payload.count({
    collection: 'posts',
    overrideAccess: false,
  })

  const totalPages = Math.ceil(totalDocs / 10)

  const pages: { pageNumber: string }[] = []

  for (let i = 1; i <= totalPages; i++) {
    pages.push({ pageNumber: String(i) })
  }

  return pages
}
