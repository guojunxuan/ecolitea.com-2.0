import { localizeMetadata } from '@/utilities/i18n/seo'
import { getLocalizedList, readyTranslationFilter } from '@/utilities/i18n/getLocalized'
import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import styles from '../pages.module.css'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page({ params }: { params?: Promise<{ lang: string }> }) {
  const { lang = 'en' } = (await params) ?? {}
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'posts',
    where: { and: await readyTranslationFilter(payload, 'posts', lang) },
    depth: 1,
    limit: 12,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      categories: true,
      meta: true,
    },
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
        {posts.totalPages > 1 && posts.page && (
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        )}
      </div>
    </div>
  )
}

export async function generateMetadata(args: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const lang = (await args?.params)?.lang ?? 'en'
  return localizeMetadata(
    {
      title: `Payload Website Template Posts`,
    },
    { path: '/posts', locale: lang },
  )
}
